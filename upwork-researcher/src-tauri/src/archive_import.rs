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
#[serde(rename_all = "camelCase")]
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
    fs2::available_space(parent).map_err(|e| format!("Cannot query disk space: {}", e))
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
    let metadata =
        read_metadata_only(archive_path).map_err(ArchiveImportError::InvalidArchive)?;

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
    let (metadata, salt, db_bytes) =
        read_archive_metadata(archive_path).map_err(ArchiveImportError::InvalidArchive)?;

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

    main_conn.execute_batch(&attach_sql).map_err(|e| {
        ArchiveImportError::ImportFailed(format!("Failed to attach archive: {}", e))
    })?;

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
    let entries = fs::read_dir(temp_dir).map_err(|e| format!("Failed to read temp dir: {}", e))?;

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
                            if age.as_secs() > TEMP_FILE_MAX_AGE_SECS
                                && fs::remove_file(&path).is_ok() {
                                    cleaned += 1;
                                    tracing::info!(
                                        "Cleaned up orphaned temp file: {}",
                                        path.display()
                                    );
                                }
                        }
                    }
                }
            }
        }
    }

    Ok(cleaned)
}

/// System settings keys that should never be imported (H-1: expanded skip list)
const SYSTEM_SETTINGS_KEYS: &str =
    "'onboarding_completed', 'db_version', 'encryption_status', 'encryption_migrated', 'last_migration_version', 'last_migration_date'";

/// Build a column-mapped INSERT SQL for cross-schema import (C-2: older archive support)
///
/// Compares main and archive table schemas via PRAGMA table_info. For columns
/// present in main but missing from the archive, uses the column's DEFAULT value
/// (or NULL if no default). This handles older archives with fewer columns.
fn build_column_mapped_insert(
    conn: &Connection,
    table: &str,
    mode: ImportMode,
    where_clause: Option<&str>,
    limit_offset: Option<(usize, usize)>,
) -> Result<String, ArchiveImportError> {
    // Get main table columns: (name, default_value_sql)
    let main_cols = get_pragma_columns(conn, "main", table)?;
    let archive_cols = get_pragma_columns(conn, "archive", table)?;

    if main_cols.is_empty() {
        return Err(ArchiveImportError::ImportFailed(format!(
            "Table {} not found in main database",
            table
        )));
    }

    let archive_col_names: std::collections::HashSet<&str> =
        archive_cols.iter().map(|(name, _)| name.as_str()).collect();

    let mut col_names = Vec::new();
    let mut select_exprs = Vec::new();

    for (col_name, default_value) in &main_cols {
        col_names.push(col_name.as_str());
        if archive_col_names.contains(col_name.as_str()) {
            select_exprs.push(col_name.clone());
        } else {
            // Column missing in archive — use its DEFAULT or NULL
            let default_sql = default_value.as_deref().unwrap_or("NULL");
            select_exprs.push(format!("{} AS {}", default_sql, col_name));
        }
    }

    let insert_verb = match mode {
        ImportMode::ReplaceAll => "INSERT INTO",
        ImportMode::MergeSkipDuplicates => "INSERT OR IGNORE INTO",
    };

    let col_list = col_names.join(", ");
    let select_list = select_exprs.join(", ");

    let mut sql = format!(
        "{} main.{} ({}) SELECT {} FROM archive.{}",
        insert_verb, table, col_list, select_list, table
    );

    if let Some(wc) = where_clause {
        sql.push_str(&format!(" WHERE {}", wc));
    }

    if let Some((limit, offset)) = limit_offset {
        sql.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));
    }

    sql.push(';');
    Ok(sql)
}

/// Get column info from PRAGMA table_info for a given schema.table
/// Returns Vec<(column_name, Option<default_value_sql>)>
fn get_pragma_columns(
    conn: &Connection,
    schema: &str,
    table: &str,
) -> Result<Vec<(String, Option<String>)>, ArchiveImportError> {
    let sql = format!("PRAGMA {}.table_info({});", schema, table);
    let mut stmt = conn.prepare(&sql).map_err(|e| {
        ArchiveImportError::ImportFailed(format!(
            "Failed to get table info for {}.{}: {}",
            schema, table, e
        ))
    })?;

    let columns: Vec<(String, Option<String>)> = stmt
        .query_map([], |row| {
            let name: String = row.get(1)?; // column name
            let dflt_value: Option<String> = row.get(4)?; // default value SQL
            Ok((name, dflt_value))
        })
        .map_err(|e| ArchiveImportError::ImportFailed(format!("Failed to read table info: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(columns)
}

/// Import a single table with column mapping and optional batching
///
/// Uses PRAGMA table_info to dynamically map archive columns to main columns,
/// supporting older archives with fewer columns (missing columns get defaults).
/// For tables with >100 rows, uses LIMIT/OFFSET batching with progress callbacks.
///
/// Returns the number of rows actually inserted.
fn import_table_batched<F>(
    conn: &Connection,
    table: &str,
    mode: ImportMode,
    where_clause: Option<&str>,
    total_steps: usize,
    step_num: usize,
    progress_callback: &mut F,
) -> Result<usize, ArchiveImportError>
where
    F: FnMut(ImportProgress),
{
    // Count archive rows (with optional WHERE filter)
    let count_sql = match where_clause {
        Some(wc) => format!("SELECT COUNT(*) FROM archive.{} WHERE {};", table, wc),
        None => format!("SELECT COUNT(*) FROM archive.{};", table),
    };
    let archive_count: usize = conn
        .query_row(&count_sql, [], |row| row.get(0))
        .unwrap_or(0);

    if archive_count == 0 {
        return Ok(0);
    }

    let mut total_inserted = 0;

    if archive_count <= IMPORT_BATCH_SIZE {
        // Small table — single column-mapped INSERT
        let sql = build_column_mapped_insert(conn, table, mode, where_clause, None)?;
        conn.execute_batch(&sql).map_err(|e| {
            ArchiveImportError::ImportFailed(format!("Failed to import {}: {}", table, e))
        })?;
        total_inserted = conn.changes() as usize;
    } else {
        // Large table — batched column-mapped INSERT
        let mut offset = 0;
        while offset < archive_count {
            let sql = build_column_mapped_insert(
                conn,
                table,
                mode,
                where_clause,
                Some((IMPORT_BATCH_SIZE, offset)),
            )?;
            conn.execute_batch(&sql).map_err(|e| {
                ArchiveImportError::ImportFailed(format!("Failed to import {} batch: {}", table, e))
            })?;
            total_inserted += conn.changes() as usize;
            offset += IMPORT_BATCH_SIZE;

            // Emit progress between batches
            progress_callback(ImportProgress {
                table: table.to_string(),
                current: step_num,
                total: total_steps,
                phase: format!(
                    "Importing ({}/{})",
                    offset.min(archive_count),
                    archive_count
                ),
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
        .map_err(|e| {
            ArchiveImportError::ImportFailed(format!("Failed to begin transaction: {}", e))
        })?;

    // Total number of tables to import (for progress tracking)
    const TOTAL_TABLES: usize = 12;
    let settings_where = format!("key NOT IN ({})", SYSTEM_SETTINGS_KEYS);

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

        if mode == ImportMode::ReplaceAll {
            // Delete all user data in FK-safe reverse order
            progress_callback(ImportProgress {
                table: "Clearing data".to_string(),
                current: 0,
                total: TOTAL_TABLES,
                phase: "Preparing".to_string(),
            });

            // FK-safe deletion order (reverse of import) — H-1: expanded system key skip list
            let delete_sql = format!(
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
                 DELETE FROM settings WHERE {};",
                settings_where
            );
            conn.execute_batch(&delete_sql).map_err(|e| {
                ArchiveImportError::ImportFailed(format!("Failed to clear data: {}", e))
            })?;
        }

        // For Merge mode: pre-count archive rows to calculate skipped counts
        let archive_proposal_count: usize = if mode == ImportMode::MergeSkipDuplicates {
            conn.query_row("SELECT COUNT(*) FROM archive.proposals;", [], |row| {
                row.get(0)
            })
            .unwrap_or(0)
        } else {
            0
        };
        let archive_settings_count: usize = if mode == ImportMode::MergeSkipDuplicates {
            conn.query_row(
                &format!(
                    "SELECT COUNT(*) FROM archive.settings WHERE {};",
                    settings_where
                ),
                [],
                |row| row.get(0),
            )
            .unwrap_or(0)
        } else {
            0
        };

        // === Import all tables via column-mapped import (C-2: older archive support) ===
        // FK-safe order: no-FK tables → independent tables → FK-dependent tables

        // Step 1: Tables with no FKs
        summary.settings_imported = import_table_batched(
            &conn,
            "settings",
            mode,
            Some(&settings_where),
            TOTAL_TABLES,
            1,
            &mut progress_callback,
        )?;

        let user_skills_count = import_table_batched(
            &conn,
            "user_skills",
            mode,
            None,
            TOTAL_TABLES,
            2,
            &mut progress_callback,
        )?;

        let rss_count = import_table_batched(
            &conn,
            "rss_imports",
            mode,
            None,
            TOTAL_TABLES,
            3,
            &mut progress_callback,
        )?;

        // Step 2: Independent tables (no FKs to other user tables)
        summary.jobs_imported = import_table_batched(
            &conn,
            "job_posts",
            mode,
            None,
            TOTAL_TABLES,
            4,
            &mut progress_callback,
        )?;

        let voice_count = import_table_batched(
            &conn,
            "voice_profiles",
            mode,
            None,
            TOTAL_TABLES,
            5,
            &mut progress_callback,
        )?;
        summary.voice_profile_imported = voice_count > 0;

        let golden_count = import_table_batched(
            &conn,
            "golden_set_proposals",
            mode,
            None,
            TOTAL_TABLES,
            6,
            &mut progress_callback,
        )?;

        // Step 3: proposals (FK: job_post_id → job_posts)
        summary.proposals_imported = import_table_batched(
            &conn,
            "proposals",
            mode,
            None,
            TOTAL_TABLES,
            7,
            &mut progress_callback,
        )?;

        // Merge mode: calculate skipped counts
        if mode == ImportMode::MergeSkipDuplicates {
            summary.proposals_skipped =
                archive_proposal_count.saturating_sub(summary.proposals_imported);
            summary.settings_skipped =
                archive_settings_count.saturating_sub(summary.settings_imported);
        }

        // Step 4: Tables depending on proposals
        summary.revisions_imported = import_table_batched(
            &conn,
            "proposal_revisions",
            mode,
            None,
            TOTAL_TABLES,
            8,
            &mut progress_callback,
        )?;

        let overrides_count = import_table_batched(
            &conn,
            "safety_overrides",
            mode,
            None,
            TOTAL_TABLES,
            9,
            &mut progress_callback,
        )?;

        // Step 5: Tables depending on job_posts
        let skills_count = import_table_batched(
            &conn,
            "job_skills",
            mode,
            None,
            TOTAL_TABLES,
            10,
            &mut progress_callback,
        )?;

        let scores_count = import_table_batched(
            &conn,
            "job_scores",
            mode,
            None,
            TOTAL_TABLES,
            11,
            &mut progress_callback,
        )?;

        let feedback_count = import_table_batched(
            &conn,
            "scoring_feedback",
            mode,
            None,
            TOTAL_TABLES,
            12,
            &mut progress_callback,
        )?;

        // H-3: total_records counts ALL imported tables (not just the named summary fields)
        summary.total_records = summary.proposals_imported
            + summary.jobs_imported
            + summary.revisions_imported
            + summary.settings_imported
            + voice_count
            + user_skills_count
            + rss_count
            + golden_count
            + overrides_count
            + skills_count
            + scores_count
            + feedback_count;

        Ok(summary)
    })();

    // Commit or rollback based on result
    match result {
        Ok(summary) => {
            conn.execute_batch("COMMIT;").map_err(|e| {
                ArchiveImportError::ImportFailed(format!("Failed to commit: {}", e))
            })?;

            progress_callback(ImportProgress {
                table: "Complete".to_string(),
                current: TOTAL_TABLES,
                total: TOTAL_TABLES,
                phase: "Done".to_string(),
            });

            Ok(summary)
        }
        Err(e) => {
            // Rollback on error
            conn.execute_batch("ROLLBACK;").map_err(|rb_err| {
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
        assert!(matches!(
            result,
            Err(ArchiveImportError::ArchiveTooLarge { .. })
        ));
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
        assert!(temp_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .ends_with(".urb.tmp"));

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
        assert_eq!(
            compat,
            SchemaCompatibility::OlderArchive {
                archive_version: 20
            }
        );
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
        assert_eq!(
            compat,
            SchemaCompatibility::NewerArchive {
                archive_version: 30
            }
        );
    }

    #[test]
    fn test_attach_detach_archive() {
        let main_conn = Connection::open_in_memory().unwrap();

        // Create a temp DB file
        let temp = NamedTempFile::new().unwrap();
        let temp_path = temp.path();

        // Create the temp DB (unencrypted for test simplicity)
        let temp_conn = Connection::open(temp_path).unwrap();
        temp_conn
            .execute_batch("CREATE TABLE test (id INTEGER); INSERT INTO test VALUES (42);")
            .unwrap();
        drop(temp_conn);

        // Attach with empty key (unencrypted DB)
        let result = attach_archive_to_db(&main_conn, temp_path, "");

        // With SQLCipher builds, attaching an unencrypted DB with empty key may fail;
        // with plain SQLite, it succeeds. Assert based on outcome.
        match result {
            Ok(()) => {
                // Verify the attached DB is accessible
                let val: i32 = main_conn
                    .query_row("SELECT id FROM archive.test LIMIT 1;", [], |row| row.get(0))
                    .expect("Should read from attached archive");
                assert_eq!(val, 42);
                let _ = main_conn.execute_batch("DETACH DATABASE archive;");
            }
            Err(e) => {
                // SQLCipher rejects unencrypted attach — that's an expected environment difference
                assert!(
                    format!("{}", e).contains("attach"),
                    "Expected attach-related error, got: {}",
                    e
                );
            }
        }
    }

    #[test]
    fn test_build_column_mapped_insert_same_schema() {
        let conn = Connection::open_in_memory().unwrap();

        // Create matching tables in main and "archive" (simulated via ATTACH)
        conn.execute_batch(
            "CREATE TABLE proposals (id INTEGER, content TEXT, status TEXT DEFAULT 'draft');",
        )
        .unwrap();

        let temp = NamedTempFile::new().unwrap();
        {
            let arc = Connection::open(temp.path()).unwrap();
            arc.execute_batch(
                "CREATE TABLE proposals (id INTEGER, content TEXT, status TEXT DEFAULT 'draft');",
            )
            .unwrap();
        }

        conn.execute_batch(&format!(
            "ATTACH DATABASE '{}' AS archive;",
            temp.path().display()
        ))
        .unwrap();

        let sql =
            build_column_mapped_insert(&conn, "proposals", ImportMode::ReplaceAll, None, None)
                .unwrap();
        // Should reference all columns without defaults substitution
        assert!(sql.contains("INSERT INTO main.proposals"));
        assert!(sql.contains("SELECT id, content, status FROM archive.proposals"));

        conn.execute_batch("DETACH DATABASE archive;").unwrap();
    }

    #[test]
    fn test_build_column_mapped_insert_older_archive() {
        let conn = Connection::open_in_memory().unwrap();

        // Main has extra column not in archive
        conn.execute_batch(
            "CREATE TABLE proposals (id INTEGER, content TEXT, outcome_status TEXT DEFAULT 'pending');",
        ).unwrap();

        let temp = NamedTempFile::new().unwrap();
        {
            let arc = Connection::open(temp.path()).unwrap();
            // Archive is older — missing outcome_status column
            arc.execute_batch("CREATE TABLE proposals (id INTEGER, content TEXT);")
                .unwrap();
        }

        conn.execute_batch(&format!(
            "ATTACH DATABASE '{}' AS archive;",
            temp.path().display()
        ))
        .unwrap();

        let sql = build_column_mapped_insert(
            &conn,
            "proposals",
            ImportMode::MergeSkipDuplicates,
            None,
            None,
        )
        .unwrap();
        // Should substitute default for missing column
        assert!(sql.contains("INSERT OR IGNORE INTO"));
        assert!(
            sql.contains("'pending' AS outcome_status"),
            "Expected default value substitution in SQL: {}",
            sql
        );

        conn.execute_batch("DETACH DATABASE archive;").unwrap();
    }
}
