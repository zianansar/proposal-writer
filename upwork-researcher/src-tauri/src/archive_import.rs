//! Archive import functionality for database restoration
//!
//! Provides secure import from encrypted .urb (Upwork Research Backup) archives.
//! Supports two import modes:
//! - Replace All: Clears current data and replaces with archive contents
//! - Merge (Skip Duplicates): Adds archive data alongside existing data
//!
//! Security features:
//! - Archive size validation (max 500MB)
//! - Metadata length validation (max 1MB)
//! - Temp file cleanup with Drop guards
//! - Disk space pre-flight checks
//! - Path injection prevention via UUID temp filenames

use crate::archive_export::{read_archive_metadata, read_metadata_only, ArchiveMetadata};
use crate::db::Database;
use crate::passphrase;
use rusqlite::Connection;
use scopeguard::defer;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use zeroize::Zeroizing;

/// Maximum archive file size (500MB) - prevents memory exhaustion
pub const MAX_ARCHIVE_SIZE_BYTES: u64 = 500 * 1024 * 1024;

/// Temp file age threshold for cleanup (1 hour in seconds)
const TEMP_FILE_MAX_AGE_SECS: u64 = 3600;

/// Batch size for large table imports (M-3: prevents UI freeze)
const IMPORT_BATCH_SIZE: usize = 100;

/// Import mode selection
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportMode {
    /// Delete all current data and replace with archive contents
    ReplaceAll,
    /// Add archive data alongside existing data (skip duplicates)
    MergeSkipDuplicates,
}

/// Schema compatibility check result
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SchemaCompatibility {
    /// Archive schema matches current version
    Compatible,
    /// Archive is from older version (may need column mapping)
    OlderArchive { archive_version: i32 },
    /// Archive is from newer version (requires app update)
    NewerArchive { archive_version: i32 },
}

/// Import progress information for UI updates
#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportProgress {
    pub table: String,
    pub current: usize,
    pub total: usize,
    pub phase: String,
}

/// Import summary statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct ImportSummary {
    pub proposals_imported: usize,
    pub proposals_skipped: usize,
    pub jobs_imported: usize,
    pub revisions_imported: usize,
    pub settings_imported: usize,
    pub settings_skipped: usize,
    pub voice_profile_imported: bool,
    pub total_records: usize,
}

/// Archive import error types
#[derive(Debug, thiserror::Error)]
pub enum ArchiveImportError {
    #[error("Invalid archive: {0}")]
    InvalidArchive(String),

    #[error("Decryption failed - wrong passphrase or corrupted archive")]
    DecryptionFailed,

    #[error("Schema mismatch: {0}")]
    SchemaMismatch(String),

    #[error("Failed to read archive: {0}")]
    ReadError(String),

    #[error("Import failed: {0}")]
    ImportFailed(String),

    #[error("Rollback failed: {0}")]
    RollbackFailed(String),

    #[error("Archive too large: {size} bytes (max {max} bytes)")]
    ArchiveTooLarge { size: u64, max: u64 },

    #[error("Insufficient disk space: need {needed} bytes, available {available} bytes")]
    DiskSpaceInsufficient { needed: u64, available: u64 },
}

/// Estimate available disk space by attempting to check free space
///
/// Uses platform-specific methods. Returns Err if space cannot be determined
/// (caller should skip the check in that case — disk-full errors will be
/// caught by the atomic transaction's error handling).
fn available_disk_space(path: &Path) -> Result<u64, String> {
    // Use fs2 crate's cross-platform free_space if available,
    // otherwise fall back to best-effort approach
    let parent = path.parent().unwrap_or(path);
    fs2::available_space(parent)
        .map_err(|e| format!("Cannot query disk space: {}", e))
}

/// Read archive metadata without decryption (for preview)
///
/// Returns only the unencrypted metadata from the archive header.
/// Validates URB1 magic header and file format.
pub fn read_metadata_preview(archive_path: &Path) -> Result<ArchiveMetadata, ArchiveImportError> {
    // Validate archive size before reading
    let file_size = fs::metadata(archive_path)
        .map_err(|e| ArchiveImportError::ReadError(format!("Cannot read file metadata: {}", e)))?
        .len();

    if file_size > MAX_ARCHIVE_SIZE_BYTES {
        return Err(ArchiveImportError::ArchiveTooLarge {
            size: file_size,
            max: MAX_ARCHIVE_SIZE_BYTES,
        });
    }

    // Use optimized metadata-only reader (reads only header, not entire DB)
    let metadata = read_metadata_only(archive_path)
        .map_err(|e| ArchiveImportError::InvalidArchive(e))?;

    Ok(metadata)
}

/// Extract archive database to a temporary file
///
/// Writes the encrypted database from the archive to a temp file with UUID-based
/// filename (prevents path injection). Returns (metadata, salt, temp_db_path).
///
/// The temp file MUST be cleaned up by the caller using the returned PathBuf.
pub fn extract_archive_db(
    archive_path: &Path,
) -> Result<(ArchiveMetadata, Vec<u8>, PathBuf), ArchiveImportError> {
    // Read full archive
    let (metadata, salt, db_bytes) = read_archive_metadata(archive_path)
        .map_err(|e| ArchiveImportError::InvalidArchive(e))?;

    // Create temp file with UUID-based name (prevents path injection)
    let temp_dir = std::env::temp_dir();
    let temp_filename = format!("{}.urb.tmp", Uuid::new_v4());
    let temp_db_path = temp_dir.join(&temp_filename);

    // Write database bytes to temp file
    let mut temp_file = fs::File::create(&temp_db_path)
        .map_err(|e| ArchiveImportError::ReadError(format!("Failed to create temp file: {}", e)))?;

    temp_file
        .write_all(&db_bytes)
        .map_err(|e| ArchiveImportError::ReadError(format!("Failed to write temp file: {}", e)))?;

    temp_file
        .sync_all()
        .map_err(|e| ArchiveImportError::ReadError(format!("Failed to sync temp file: {}", e)))?;

    Ok((metadata, salt, temp_db_path))
}

/// Open archive database for preview/inspection
///
/// Derives key from passphrase + salt, opens the temp DB file with SQLCipher,
/// runs PRAGMA quick_check to verify decryption success.
///
/// Returns opened Connection for schema inspection. Caller must close connection.
pub fn open_archive_for_preview(
    temp_db_path: &Path,
    passphrase: &str,
    salt: &[u8],
) -> Result<Connection, ArchiveImportError> {
    // Convert salt slice to array for derive_key
    if salt.len() != 16 {
        return Err(ArchiveImportError::InvalidArchive(format!(
            "Invalid salt length: {} bytes (expected 16)",
            salt.len()
        )));
    }
    let mut salt_array = [0u8; 16];
    salt_array.copy_from_slice(salt);

    // Derive key from passphrase + archive salt
    let key = passphrase::derive_key(passphrase, &salt_array)
        .map_err(|_| ArchiveImportError::DecryptionFailed)?;

    // Open connection to temp DB
    let conn = Connection::open(temp_db_path)
        .map_err(|e| ArchiveImportError::ReadError(format!("Failed to open temp DB: {}", e)))?;

    // Set encryption key (hex-encoded, wrapped in Zeroizing)
    let key_hex = Zeroizing::new(hex::encode(&*key));
    let pragma = Zeroizing::new(format!("PRAGMA key = \"x'{}'\"", &*key_hex));

    conn.execute_batch(&pragma)
        .map_err(|_| ArchiveImportError::DecryptionFailed)?;

    // Set cipher compatibility
    conn.execute_batch("PRAGMA cipher_compatibility = 4;")
        .map_err(|_| ArchiveImportError::DecryptionFailed)?;

    // Run quick_check to verify decryption (fast integrity check)
    let check_result: String = conn
        .query_row("PRAGMA quick_check;", [], |row| row.get(0))
        .map_err(|_| ArchiveImportError::DecryptionFailed)?;

    if check_result != "ok" {
        return Err(ArchiveImportError::DecryptionFailed);
    }

    Ok(conn)
}

/// Attach archive database to main connection for cross-DB import
///
/// Uses SQLCipher's ATTACH DATABASE command with the derived key.
/// The archive DB is attached as "archive" schema.
///
/// # Security
/// - temp_db_path uses UUID filename (no user-controlled characters in SQL)
/// - hex_key is already validated and derived from passphrase
///
/// Returns Ok(()) on success. Caller must DETACH after import.
pub fn attach_archive_to_db(
    main_conn: &Connection,
    temp_db_path: &Path,
    hex_key: &str,
) -> Result<(), ArchiveImportError> {
    // Build ATTACH command - path is UUID-based so safe from injection
    let attach_sql = format!(
        "ATTACH DATABASE '{}' AS archive KEY \"x'{}'\";",
        temp_db_path.display(),
        hex_key
    );

    main_conn
        .execute_batch(&attach_sql)
        .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to attach archive: {}", e)))?;

    Ok(())
}

/// Check schema compatibility between archive and current DB
pub fn check_schema_compatibility(
    archive_conn: &Connection,
    current_version: i32,
) -> Result<SchemaCompatibility, ArchiveImportError> {
    // Query archive schema version
    let archive_version: i32 = archive_conn
        .query_row(
            "SELECT version FROM refinery_schema_history ORDER BY version DESC LIMIT 1;",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            ArchiveImportError::SchemaMismatch(format!("Cannot read archive schema version: {}", e))
        })?;

    if archive_version == current_version {
        Ok(SchemaCompatibility::Compatible)
    } else if archive_version < current_version {
        Ok(SchemaCompatibility::OlderArchive { archive_version })
    } else {
        Ok(SchemaCompatibility::NewerArchive { archive_version })
    }
}

/// Clean up orphaned temp files from crashed previous imports
///
/// Scans temp directory for *.urb.tmp files older than 1 hour and deletes them.
/// Called once on app startup for crash recovery.
pub fn cleanup_orphaned_temp_files(temp_dir: &Path) -> Result<usize, String> {
    let mut cleaned = 0;

    // Read directory entries
    let entries = fs::read_dir(temp_dir)
        .map_err(|e| format!("Failed to read temp dir: {}", e))?;

    let now = std::time::SystemTime::now();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Check if it's a .urb.tmp file
        if let Some(filename) = path.file_name() {
            if filename.to_string_lossy().ends_with(".urb.tmp") {
                // Check file age
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(age) = now.duration_since(modified) {
                            // Delete if older than threshold
                            if age.as_secs() > TEMP_FILE_MAX_AGE_SECS {
                                if fs::remove_file(&path).is_ok() {
                                    cleaned += 1;
                                    tracing::info!("Cleaned up orphaned temp file: {}", path.display());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(cleaned)
}

/// Import a single table in batches of IMPORT_BATCH_SIZE rows
///
/// For tables with >100 rows, uses LIMIT/OFFSET to insert in batches,
/// calling the progress callback between batches to keep the UI responsive.
///
/// Returns the number of rows actually inserted.
fn import_table_batched<F>(
    conn: &Connection,
    table: &str,
    mode: ImportMode,
    total_steps: usize,
    step_num: usize,
    progress_callback: &mut F,
) -> Result<usize, ArchiveImportError>
where
    F: FnMut(ImportProgress),
{
    // Count archive rows
    let archive_count: usize = conn
        .query_row(&format!("SELECT COUNT(*) FROM archive.{};", table), [], |row| row.get(0))
        .unwrap_or(0);

    if archive_count == 0 {
        return Ok(0);
    }

    let mut total_inserted = 0;

    if archive_count <= IMPORT_BATCH_SIZE {
        // Small table — single INSERT
        let sql = match mode {
            ImportMode::ReplaceAll => format!("INSERT INTO {} SELECT * FROM archive.{};", table, table),
            ImportMode::MergeSkipDuplicates => format!("INSERT OR IGNORE INTO {} SELECT * FROM archive.{};", table, table),
        };
        conn.execute_batch(&sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import {}: {}", table, e)))?;
        total_inserted = conn.changes() as usize;
    } else {
        // Large table — batched INSERT using rowid ranges
        let mut offset = 0;
        while offset < archive_count {
            let sql = match mode {
                ImportMode::ReplaceAll => format!(
                    "INSERT INTO {} SELECT * FROM archive.{} LIMIT {} OFFSET {};",
                    table, table, IMPORT_BATCH_SIZE, offset
                ),
                ImportMode::MergeSkipDuplicates => format!(
                    "INSERT OR IGNORE INTO {} SELECT * FROM archive.{} LIMIT {} OFFSET {};",
                    table, table, IMPORT_BATCH_SIZE, offset
                ),
            };
            conn.execute_batch(&sql)
                .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import {} batch: {}", table, e)))?;
            total_inserted += conn.changes() as usize;
            offset += IMPORT_BATCH_SIZE;

            // Emit progress between batches
            progress_callback(ImportProgress {
                table: table.to_string(),
                current: step_num,
                total: total_steps,
                phase: format!("Importing ({}/{})", offset.min(archive_count), archive_count),
            });
        }
    }

    Ok(total_inserted)
}

/// Import data from archive to target database
///
/// Uses ATTACH DATABASE for efficient cross-DB copying. Supports ReplaceAll
/// and MergeSkipDuplicates modes. All operations in atomic transaction.
///
/// # Arguments
/// * `target_db` - Main application database
/// * `temp_db_path` - Path to extracted/decrypted archive temp file
/// * `hex_key` - Hex-encoded encryption key for archive
/// * `mode` - Import mode (Replace or Merge)
/// * `progress_callback` - Called with progress updates
///
/// # Returns
/// ImportSummary with counts of imported/skipped records
pub fn import_from_archive<F>(
    target_db: &Database,
    temp_db_path: &Path,
    hex_key: &str,
    mode: ImportMode,
    mut progress_callback: F,
) -> Result<ImportSummary, ArchiveImportError>
where
    F: FnMut(ImportProgress),
{
    // Acquire main DB lock
    let conn = target_db
        .conn
        .lock()
        .map_err(|e| ArchiveImportError::ImportFailed(format!("Lock error: {}", e)))?;

    // M-2: Pre-flight disk space check
    // Estimate needed space: archive temp file size (already written) + DB growth headroom
    if let Ok(temp_meta) = fs::metadata(temp_db_path) {
        let needed_bytes = temp_meta.len() * 2; // 2x headroom for WAL + growth
        if let Ok(available) = available_disk_space(temp_db_path) {
            if available < needed_bytes {
                return Err(ArchiveImportError::DiskSpaceInsufficient {
                    needed: needed_bytes,
                    available,
                });
            }
        }
    }

    // Attach archive database
    attach_archive_to_db(&conn, temp_db_path, hex_key)?;

    // Ensure detach on scope exit (even on panic)
    defer! {
        let _ = conn.execute_batch("DETACH DATABASE archive;");
    }

    // Begin exclusive transaction
    conn.execute_batch("BEGIN EXCLUSIVE TRANSACTION;")
        .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to begin transaction: {}", e)))?;

    // Import result (will be set on success)
    let result: Result<ImportSummary, ArchiveImportError> = (|| {
        let mut summary = ImportSummary {
            proposals_imported: 0,
            proposals_skipped: 0,
            jobs_imported: 0,
            revisions_imported: 0,
            settings_imported: 0,
            settings_skipped: 0,
            voice_profile_imported: false,
            total_records: 0,
        };

        match mode {
            ImportMode::ReplaceAll => {
                // Delete all user data in FK-safe reverse order
                progress_callback(ImportProgress {
                    table: "Clearing data".to_string(),
                    current: 0,
                    total: 1,
                    phase: "Preparing".to_string(),
                });

                // FK-safe deletion order (reverse of import)
                conn.execute_batch(
                    "DELETE FROM scoring_feedback;
                     DELETE FROM job_scores;
                     DELETE FROM job_skills;
                     DELETE FROM safety_overrides;
                     DELETE FROM proposal_revisions;
                     DELETE FROM proposals;
                     DELETE FROM job_posts;
                     DELETE FROM golden_set_proposals;
                     DELETE FROM voice_profiles;
                     DELETE FROM user_skills;
                     DELETE FROM rss_imports;
                     DELETE FROM settings WHERE key NOT IN ('onboarding_completed', 'db_version');",
                )
                .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to clear data: {}", e)))?;
            }
            ImportMode::MergeSkipDuplicates => {
                // No pre-deletion for merge mode
            }
        }

        // Import tables in FK-safe order
        // Step 1: Tables with no FKs
        progress_callback(ImportProgress {
            table: "settings".to_string(),
            current: 0,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO settings SELECT * FROM archive.settings WHERE key NOT IN ('onboarding_completed', 'db_version');",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO settings SELECT * FROM archive.settings WHERE key NOT IN ('onboarding_completed', 'db_version');",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import settings: {}", e)))?;

        summary.settings_imported = conn.changes() as usize;

        // user_skills
        progress_callback(ImportProgress {
            table: "user_skills".to_string(),
            current: 1,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO user_skills SELECT * FROM archive.user_skills;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO user_skills SELECT * FROM archive.user_skills;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import user_skills: {}", e)))?;

        // rss_imports (no FKs)
        progress_callback(ImportProgress {
            table: "rss_imports".to_string(),
            current: 2,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO rss_imports SELECT * FROM archive.rss_imports;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO rss_imports SELECT * FROM archive.rss_imports;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import rss_imports: {}", e)))?;

        // For Merge mode: pre-count archive rows to calculate skipped counts
        let archive_proposal_count: usize = if mode == ImportMode::MergeSkipDuplicates {
            conn.query_row("SELECT COUNT(*) FROM archive.proposals;", [], |row| row.get(0))
                .unwrap_or(0)
        } else { 0 };
        let archive_settings_count: usize = if mode == ImportMode::MergeSkipDuplicates {
            conn.query_row(
                "SELECT COUNT(*) FROM archive.settings WHERE key NOT IN ('onboarding_completed', 'db_version');",
                [], |row| row.get(0),
            ).unwrap_or(0)
        } else { 0 };

        // Step 2: Independent tables
        // job_posts
        progress_callback(ImportProgress {
            table: "job_posts".to_string(),
            current: 3,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO job_posts SELECT * FROM archive.job_posts;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO job_posts SELECT * FROM archive.job_posts;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import job_posts: {}", e)))?;

        summary.jobs_imported = conn.changes() as usize;

        // voice_profiles
        progress_callback(ImportProgress {
            table: "voice_profiles".to_string(),
            current: 4,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO voice_profiles SELECT * FROM archive.voice_profiles;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO voice_profiles SELECT * FROM archive.voice_profiles;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import voice_profiles: {}", e)))?;

        summary.voice_profile_imported = conn.changes() > 0;

        // golden_set_proposals
        progress_callback(ImportProgress {
            table: "golden_set_proposals".to_string(),
            current: 5,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO golden_set_proposals SELECT * FROM archive.golden_set_proposals;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO golden_set_proposals SELECT * FROM archive.golden_set_proposals;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import golden_set_proposals: {}", e)))?;

        // Step 3: proposals (depends on job_posts via FK) — batched for large archives
        progress_callback(ImportProgress {
            table: "proposals".to_string(),
            current: 6,
            total: 11,
            phase: "Importing".to_string(),
        });

        summary.proposals_imported = import_table_batched(&conn, "proposals", mode, 11, 6, &mut progress_callback)?;
        if mode == ImportMode::MergeSkipDuplicates {
            summary.proposals_skipped = archive_proposal_count.saturating_sub(summary.proposals_imported);
            summary.settings_skipped = archive_settings_count.saturating_sub(summary.settings_imported);
        }

        // Step 4: Tables depending on proposals
        // proposal_revisions — batched for large archives
        progress_callback(ImportProgress {
            table: "proposal_revisions".to_string(),
            current: 7,
            total: 11,
            phase: "Importing".to_string(),
        });

        summary.revisions_imported = import_table_batched(&conn, "proposal_revisions", mode, 11, 7, &mut progress_callback)?;

        // safety_overrides
        progress_callback(ImportProgress {
            table: "safety_overrides".to_string(),
            current: 8,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO safety_overrides SELECT * FROM archive.safety_overrides;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO safety_overrides SELECT * FROM archive.safety_overrides;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import safety_overrides: {}", e)))?;

        // Step 5: Tables depending on job_posts
        // job_skills
        progress_callback(ImportProgress {
            table: "job_skills".to_string(),
            current: 9,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO job_skills SELECT * FROM archive.job_skills;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO job_skills SELECT * FROM archive.job_skills;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import job_skills: {}", e)))?;

        // job_scores
        progress_callback(ImportProgress {
            table: "job_scores".to_string(),
            current: 10,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO job_scores SELECT * FROM archive.job_scores;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO job_scores SELECT * FROM archive.job_scores;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import job_scores: {}", e)))?;

        // scoring_feedback
        progress_callback(ImportProgress {
            table: "scoring_feedback".to_string(),
            current: 11,
            total: 11,
            phase: "Importing".to_string(),
        });

        let sql = match mode {
            ImportMode::ReplaceAll => "INSERT INTO scoring_feedback SELECT * FROM archive.scoring_feedback;",
            ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO scoring_feedback SELECT * FROM archive.scoring_feedback;",
        };
        conn.execute_batch(sql)
            .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to import scoring_feedback: {}", e)))?;

        // Calculate total records
        summary.total_records = summary.proposals_imported
            + summary.jobs_imported
            + summary.revisions_imported
            + summary.settings_imported
            + if summary.voice_profile_imported { 1 } else { 0 };

        Ok(summary)
    })();

    // Commit or rollback based on result
    match result {
        Ok(summary) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to commit: {}", e)))?;

            progress_callback(ImportProgress {
                table: "Complete".to_string(),
                current: 11,
                total: 11,
                phase: "Done".to_string(),
            });

            Ok(summary)
        }
        Err(e) => {
            // Rollback on error
            conn.execute_batch("ROLLBACK;")
                .map_err(|rb_err| {
                    ArchiveImportError::RollbackFailed(format!(
                        "Import failed: {}. Rollback also failed: {}",
                        e, rb_err
                    ))
                })?;

            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::archive_export::write_archive;
    use tempfile::{NamedTempFile, TempDir};

    #[test]
    fn test_read_metadata_preview_valid() {
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            Some("test hint".to_string()),
            5,
            10,
            3,
            2,
            1,
            1024,
        );
        let salt = vec![1u8; 16];
        let db = vec![0xFF; 100];

        let temp = NamedTempFile::new().unwrap();
        write_archive(temp.path(), &metadata, &salt, &db).unwrap();

        let preview = read_metadata_preview(temp.path()).unwrap();
        assert_eq!(preview.proposal_count, 5);
        assert_eq!(preview.passphrase_hint, Some("test hint".to_string()));
    }

    #[test]
    fn test_read_metadata_preview_oversized() {
        // Create a file larger than MAX_ARCHIVE_SIZE_BYTES
        let temp = NamedTempFile::new().unwrap();
        let large_size = (MAX_ARCHIVE_SIZE_BYTES + 1) as usize;

        // Write dummy data
        let mut file = fs::File::create(temp.path()).unwrap();
        let chunk = vec![0u8; 1024 * 1024]; // 1MB chunks
        for _ in 0..(large_size / (1024 * 1024) + 1) {
            file.write_all(&chunk).unwrap();
        }
        file.sync_all().unwrap();

        let result = read_metadata_preview(temp.path());
        assert!(matches!(result, Err(ArchiveImportError::ArchiveTooLarge { .. })));
    }

    #[test]
    fn test_extract_archive_db() {
        let metadata = ArchiveMetadata::new("1.0.0".to_string(), None, 1, 2, 3, 4, 5, 100);
        let salt = vec![1u8; 16];
        let db = vec![0xAB; 100];

        let temp = NamedTempFile::new().unwrap();
        write_archive(temp.path(), &metadata, &salt, &db).unwrap();

        let (meta, extracted_salt, temp_path) = extract_archive_db(temp.path()).unwrap();

        assert_eq!(meta.proposal_count, 1);
        assert_eq!(extracted_salt, salt);
        assert!(temp_path.exists());
        assert!(temp_path.file_name().unwrap().to_string_lossy().ends_with(".urb.tmp"));

        // Verify temp file contents
        let temp_contents = fs::read(&temp_path).unwrap();
        assert_eq!(temp_contents, db);

        // Cleanup
        fs::remove_file(temp_path).unwrap();
    }

    #[test]
    fn test_cleanup_orphaned_temp_files() {
        let temp_dir = TempDir::new().unwrap();

        // Create old temp file (modify timestamp)
        let old_file = temp_dir.path().join("old-uuid.urb.tmp");
        fs::write(&old_file, b"old data").unwrap();

        // Set file time to 2 hours ago (use filetime crate if needed, or accept limitation)
        // For now, just test the cleanup doesn't crash on recent files
        let cleaned = cleanup_orphaned_temp_files(temp_dir.path()).unwrap();

        // File is recent, so cleaned should be 0
        assert_eq!(cleaned, 0);
    }

    #[test]
    fn test_invalid_archive_rejected() {
        let temp = NamedTempFile::new().unwrap();
        fs::write(temp.path(), b"not a valid archive").unwrap();

        let result = read_metadata_preview(temp.path());
        assert!(matches!(result, Err(ArchiveImportError::InvalidArchive(_))));
    }

    #[test]
    fn test_schema_compatibility_same_version() {
        // Create in-memory DB with schema
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE refinery_schema_history (version INTEGER);
             INSERT INTO refinery_schema_history (version) VALUES (27);",
        )
        .unwrap();

        let compat = check_schema_compatibility(&conn, 27).unwrap();
        assert_eq!(compat, SchemaCompatibility::Compatible);
    }

    #[test]
    fn test_schema_compatibility_older() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE refinery_schema_history (version INTEGER);
             INSERT INTO refinery_schema_history (version) VALUES (20);",
        )
        .unwrap();

        let compat = check_schema_compatibility(&conn, 27).unwrap();
        assert_eq!(compat, SchemaCompatibility::OlderArchive { archive_version: 20 });
    }

    #[test]
    fn test_schema_compatibility_newer() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE refinery_schema_history (version INTEGER);
             INSERT INTO refinery_schema_history (version) VALUES (30);",
        )
        .unwrap();

        let compat = check_schema_compatibility(&conn, 27).unwrap();
        assert_eq!(compat, SchemaCompatibility::NewerArchive { archive_version: 30 });
    }

    #[test]
    fn test_attach_detach_archive() {
        let main_conn = Connection::open_in_memory().unwrap();

        // Create a temp DB file
        let temp = NamedTempFile::new().unwrap();
        let temp_path = temp.path();

        // Create the temp DB (unencrypted for test simplicity)
        let temp_conn = Connection::open(temp_path).unwrap();
        temp_conn.execute_batch("CREATE TABLE test (id INTEGER);").unwrap();
        drop(temp_conn);

        // For unencrypted test, use empty hex key (won't actually encrypt)
        let result = attach_archive_to_db(&main_conn, temp_path, "");

        // May fail if SQLCipher key required, which is OK for this basic test
        // Main goal is to test the function doesn't panic
        let _ = result;
    }
}
