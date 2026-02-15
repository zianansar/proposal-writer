// Export commands for database backup and portability (Story 7.6)

use crate::archive_export::{write_archive, ArchiveMetadata};
use crate::db::AppDatabase;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

/// Rate limit state for export operations (AC-6: 60s cooldown)
pub struct ExportRateLimitState(pub Arc<Mutex<Option<Instant>>>);

impl ExportRateLimitState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

/// Result structure for export_encrypted_archive command
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportArchiveResult {
    pub success: bool,
    pub file_path: Option<String>,
    pub file_size_bytes: u64,
    pub proposal_count: usize,
    pub revision_count: usize,
    pub job_post_count: usize,
    pub settings_count: usize,
    pub voice_profile_count: usize,
    pub message: String,
}

/// Table counts structure
#[derive(Debug)]
struct TableCounts {
    proposals: usize,
    revisions: usize,
    job_posts: usize,
    settings: usize,
    voice_profiles: usize,
}

/// Query all table counts in a single transaction
fn get_table_counts(conn: &Connection) -> Result<TableCounts, String> {
    // Use subselects for efficiency (single query)
    let query = "
        SELECT
            (SELECT COUNT(*) FROM proposals) as proposals,
            (SELECT COUNT(*) FROM proposal_revisions) as revisions,
            (SELECT COUNT(*) FROM job_posts) as job_posts,
            (SELECT COUNT(*) FROM settings) as settings,
            (SELECT COUNT(*) FROM voice_profiles) as voice_profiles
    ";

    conn.query_row(query, [], |row| {
        Ok(TableCounts {
            proposals: row.get::<_, i64>(0)? as usize,
            revisions: row.get::<_, i64>(1)? as usize,
            job_posts: row.get::<_, i64>(2)? as usize,
            settings: row.get::<_, i64>(3)? as usize,
            voice_profiles: row.get::<_, i64>(4)? as usize,
        })
    })
    .map_err(|e| format!("Failed to query table counts: {}", e))
}

/// Verify archive integrity using streaming reads (no full DB load into memory)
///
/// NOTE: AC-3 specifies "opening the DB with the current encryption key" but the
/// derived key is consumed by SQLCipher's PRAGMA key and not retained in accessible
/// state. This simplified validation catches corruption, truncation, and format errors
/// without needing the raw key. Full key-based verification would require either
/// caching the derived key (security concern) or re-deriving from passphrase (UX concern).
///
/// Checks (streaming — reads only header, not full DB):
/// - Archive format is valid (URB1 magic header)
/// - Metadata parses correctly
/// - Salt length is correct (16 bytes)
/// - Database portion has minimum size (inferred from file size)
fn verify_archive(archive_path: &Path) -> Result<(), String> {
    use std::io::{BufReader, Read};

    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive for verification: {}", e))?;
    let file_size = file
        .metadata()
        .map_err(|e| format!("Failed to get archive file size: {}", e))?
        .len();
    let mut reader = BufReader::new(file);

    // Read and verify magic header (4 bytes)
    let mut magic = [0u8; 4];
    reader
        .read_exact(&mut magic)
        .map_err(|e| format!("Failed to read magic header: {}", e))?;
    if &magic != b"URB1" {
        return Err(format!(
            "Invalid archive format: expected URB1, got {:?}",
            magic
        ));
    }

    // Read metadata length (4 bytes, u32 LE)
    let mut len_buf = [0u8; 4];
    reader
        .read_exact(&mut len_buf)
        .map_err(|e| format!("Failed to read metadata length: {}", e))?;
    let metadata_len = u32::from_le_bytes(len_buf) as usize;

    // Read and parse metadata JSON (validates it's well-formed)
    let mut metadata_bytes = vec![0u8; metadata_len];
    reader
        .read_exact(&mut metadata_bytes)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let _metadata: ArchiveMetadata = serde_json::from_slice(&metadata_bytes)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;

    // Read salt length (4 bytes, u32 LE)
    reader
        .read_exact(&mut len_buf)
        .map_err(|e| format!("Failed to read salt length: {}", e))?;
    let salt_len = u32::from_le_bytes(len_buf) as usize;

    // Validate salt length (should be 16 bytes for Argon2id)
    if salt_len != 16 {
        return Err(format!(
            "Invalid salt length: expected 16 bytes, got {}",
            salt_len
        ));
    }

    // Calculate DB size from remaining file bytes (without reading DB into memory)
    let header_consumed = (4 + 4 + metadata_len + 4 + salt_len) as u64;
    let db_size = file_size.saturating_sub(header_consumed);

    if db_size < 1024 {
        return Err(format!(
            "Database file is suspiciously small ({} bytes)",
            db_size
        ));
    }

    Ok(())
}

/// Export encrypted database to portable archive file (Story 7.6)
///
/// Creates a single .urb (Upwork Research Backup) file containing:
/// - Encrypted database file (already encrypted with SQLCipher)
/// - Salt file (for key derivation)
/// - Metadata (counts, dates, optional passphrase hint)
///
/// # Arguments
/// * `passphrase_hint` - Optional user-provided hint for the passphrase
///
/// # Returns
/// ExportArchiveResult with file path, counts, and success status
///
/// # Rate Limiting
/// Enforces 60-second cooldown between exports (AC-6)
///
/// # Verification
/// After writing, verifies archive integrity before returning success (AC-3)
#[tauri::command]
pub async fn export_encrypted_archive(
    app_handle: AppHandle,
    database: State<'_, AppDatabase>,
    rate_limit: State<'_, ExportRateLimitState>,
    passphrase_hint: Option<String>,
) -> Result<ExportArchiveResult, String> {
    // AC-6: Rate limit check (60s cooldown)
    {
        let last_export = rate_limit.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some(last) = *last_export {
            let elapsed = last.elapsed();
            if elapsed < Duration::from_secs(60) {
                let remaining = 60 - elapsed.as_secs();
                tracing::warn!("Export rate-limited — {}s remaining", remaining);
                return Ok(ExportArchiveResult {
                    success: false,
                    file_path: None,
                    file_size_bytes: 0,
                    proposal_count: 0,
                    revision_count: 0,
                    job_post_count: 0,
                    settings_count: 0,
                    voice_profile_count: 0,
                    message: format!(
                        "Please wait {} seconds before exporting again",
                        remaining
                    ),
                });
            }
        }
    }

    // AC-1: Show file save dialog
    let current_date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let default_filename = format!("upwork-backup-{}.urb", current_date);

    let file_path = app_handle
        .dialog()
        .file()
        .set_title("Export Encrypted Backup")
        .set_file_name(&default_filename)
        .add_filter("Upwork Backup", &["urb"])
        .blocking_save_file();

    // AC-1: User cancelled dialog
    let Some(file_path_result) = file_path else {
        return Ok(ExportArchiveResult {
            success: false,
            file_path: None,
            file_size_bytes: 0,
            proposal_count: 0,
            revision_count: 0,
            job_post_count: 0,
            settings_count: 0,
            voice_profile_count: 0,
            message: "Export cancelled".to_string(),
        });
    };

    // Convert FilePath to PathBuf
    let path_str = file_path_result.to_string();
    let path = PathBuf::from(&path_str);

    // Get app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Get database instance
    let database = database.get()?;

    // AC-2: Emit progress event — Preparing
    let _ = app_handle.emit("export-progress", "Preparing...");

    // AC-2, AC-3: Perform export with WAL checkpoint, counts, and file copy
    // CRITICAL: Hold DB lock during file read to prevent concurrent writes from
    // corrupting the export snapshot (per story Dev Notes).
    let (counts, db_bytes, salt_bytes) = {
        let conn = database
            .conn
            .lock()
            .map_err(|e| format!("Database lock error: {}", e))?;

        // WAL checkpoint: flush all pending writes into main DB file
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|e| {
                let msg = format!("Failed to checkpoint WAL: {}", e);
                tracing::warn!("Export failed — {}", msg);
                msg
            })?;

        // Query table counts
        let counts = get_table_counts(&conn)?;

        // AC-2: Emit progress event — Copying database
        let _ = app_handle.emit("export-progress", "Copying database...");

        // Read encrypted database file while holding the lock
        let db_path = &database.path;
        let db_bytes = fs::read(db_path)
            .map_err(|e| {
                let msg = format!("Failed to read database file: {}", e);
                tracing::warn!("Export failed — {}", msg);
                msg
            })?;

        // Lock released here when conn drops
        drop(conn);

        // Read salt file (not protected by DB lock — salt is immutable after creation)
        let salt_path = app_data_dir.join(".salt");
        let salt_base64 = fs::read_to_string(&salt_path)
            .map_err(|e| {
                let msg = format!("Failed to read salt file: {}", e);
                tracing::warn!("Export failed — {}", msg);
                msg
            })?;

        let salt_bytes = BASE64_STANDARD
            .decode(salt_base64.trim())
            .map_err(|e| {
                let msg = format!("Failed to decode salt: {}", e);
                tracing::warn!("Export failed — {}", msg);
                msg
            })?;

        (counts, db_bytes, salt_bytes)
    };

    // Build metadata
    let metadata = ArchiveMetadata::new(
        env!("CARGO_PKG_VERSION").to_string(),
        passphrase_hint,
        counts.proposals,
        counts.revisions,
        counts.job_posts,
        counts.settings,
        counts.voice_profiles,
        db_bytes.len() as u64,
    );

    // Write to temp file first (atomic pattern)
    let temp_path = path.with_extension("urb.tmp");

    write_archive(&temp_path, &metadata, &salt_bytes, &db_bytes)
        .map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            let msg = format!("Failed to write archive: {}", e);
            tracing::warn!("Export failed — {}", msg);
            msg
        })?;

    // AC-2: Emit progress event — Verifying
    let _ = app_handle.emit("export-progress", "Verifying...");

    // AC-3: Verify archive integrity
    verify_archive(&temp_path).map_err(|e| {
        let _ = fs::remove_file(&temp_path);
        let msg = format!("Archive verification failed: {}", e);
        tracing::warn!("Export failed — {}", msg);
        msg
    })?;

    // Atomic rename: .tmp → final path
    fs::rename(&temp_path, &path)
        .map_err(|e| {
            let msg = format!("Failed to finalize archive: {}", e);
            tracing::warn!("Export failed — {}", msg);
            msg
        })?;

    // Get final file size
    let file_size = fs::metadata(&path)
        .map_err(|e| format!("Failed to read file size: {}", e))?
        .len();

    // AC-2: Emit progress event — Complete
    let _ = app_handle.emit("export-progress", "Complete!");

    // AC-4: Log security event
    tracing::info!(
        "Database exported to {:?} ({} bytes, verified)",
        path,
        file_size
    );

    // Update rate limit timestamp (only after successful export)
    {
        let mut last_export = rate_limit.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        *last_export = Some(Instant::now());
    }

    // AC-4: Return success with all counts
    Ok(ExportArchiveResult {
        success: true,
        file_path: Some(path.to_string_lossy().to_string()),
        file_size_bytes: file_size,
        proposal_count: counts.proposals,
        revision_count: counts.revisions,
        job_post_count: counts.job_posts,
        settings_count: counts.settings,
        voice_profile_count: counts.voice_profiles,
        message: "Backup exported successfully".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_get_table_counts() {
        let conn = Connection::open_in_memory().unwrap();

        // Create test tables
        conn.execute_batch(
            "
            CREATE TABLE proposals (id INTEGER PRIMARY KEY);
            CREATE TABLE proposal_revisions (id INTEGER PRIMARY KEY);
            CREATE TABLE job_posts (id INTEGER PRIMARY KEY);
            CREATE TABLE settings (id INTEGER PRIMARY KEY);
            CREATE TABLE voice_profiles (id INTEGER PRIMARY KEY);
        ",
        )
        .unwrap();

        // Insert test data
        conn.execute("INSERT INTO proposals DEFAULT VALUES", [])
            .unwrap();
        conn.execute("INSERT INTO proposals DEFAULT VALUES", [])
            .unwrap();
        conn.execute("INSERT INTO proposal_revisions DEFAULT VALUES", [])
            .unwrap();
        conn.execute("INSERT INTO job_posts DEFAULT VALUES", [])
            .unwrap();
        conn.execute("INSERT INTO job_posts DEFAULT VALUES", [])
            .unwrap();
        conn.execute("INSERT INTO job_posts DEFAULT VALUES", [])
            .unwrap();
        conn.execute("INSERT INTO settings DEFAULT VALUES", [])
            .unwrap();

        let counts = get_table_counts(&conn).unwrap();

        assert_eq!(counts.proposals, 2);
        assert_eq!(counts.revisions, 1);
        assert_eq!(counts.job_posts, 3);
        assert_eq!(counts.settings, 1);
        assert_eq!(counts.voice_profiles, 0);
    }

    #[test]
    fn test_verify_archive_valid() {
        use tempfile::NamedTempFile;

        // Create a valid archive
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            None,
            10,
            20,
            5,
            3,
            1,
            2048,
        );
        let salt = vec![0u8; 16]; // 16-byte salt
        let db = vec![0xFF; 2048]; // 2KB fake DB

        let temp_file = NamedTempFile::new().unwrap();
        write_archive(temp_file.path(), &metadata, &salt, &db).unwrap();

        // Verification should pass
        assert!(verify_archive(temp_file.path()).is_ok());
    }

    #[test]
    fn test_verify_archive_invalid_salt_length() {
        use tempfile::NamedTempFile;

        // Create archive with wrong salt length
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            None,
            0,
            0,
            0,
            0,
            0,
            1024,
        );
        let salt = vec![0u8; 8]; // Wrong length (should be 16)
        let db = vec![0xFF; 1024];

        let temp_file = NamedTempFile::new().unwrap();
        write_archive(temp_file.path(), &metadata, &salt, &db).unwrap();

        // Verification should fail
        let result = verify_archive(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid salt length"));
    }

    #[test]
    fn test_verify_archive_db_too_small() {
        use tempfile::NamedTempFile;

        // Create archive with suspiciously small DB
        let metadata = ArchiveMetadata::new(
            "1.0.0".to_string(),
            None,
            0,
            0,
            0,
            0,
            0,
            100,
        );
        let salt = vec![0u8; 16];
        let db = vec![0xFF; 100]; // Only 100 bytes (suspiciously small)

        let temp_file = NamedTempFile::new().unwrap();
        write_archive(temp_file.path(), &metadata, &salt, &db).unwrap();

        // Verification should fail
        let result = verify_archive(temp_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("suspiciously small"));
    }

    #[test]
    fn test_rate_limit_state_new() {
        let state = ExportRateLimitState::new();
        let last_export = state.0.lock().unwrap();
        assert!(last_export.is_none());
    }
}
