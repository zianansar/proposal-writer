//! Backup module for pre-migration data export (Story 2.2)
//!
//! Provides automated backup creation before SQLCipher migration to ensure
//! data safety and recovery capability if migration fails.
//!
//! Key features:
//! - Automatic JSON export of all database tables
//! - Timestamp-based filenames for uniqueness
//! - Atomic file writes (temp → rename)
//! - Verification of backup readability
//! - NFR-1: <5 seconds for typical datasets (50 proposals)

#[cfg(test)]
mod tests;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::db::Database;
use crate::db::queries::{proposals, settings};

/// Errors that can occur during backup operations
#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("Failed to create backup directory: {0}")]
    DirectoryCreationFailed(String),

    #[error("Failed to query database: {0}")]
    DatabaseQueryFailed(String),

    #[error("Failed to serialize backup data: {0}")]
    SerializationFailed(String),

    #[error("Failed to write backup file: {0}")]
    FileWriteFailed(String),

    #[error("Backup verification failed: {0}")]
    VerificationFailed(String),

    #[error("Database lock error: {0}")]
    DatabaseLockError(String),
}

/// Metadata about a completed backup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub file_path: PathBuf,
    pub timestamp: String,
    pub proposal_count: usize,
    pub settings_count: usize,
    pub job_posts_count: usize,
}

/// Complete backup data structure
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupData {
    pub metadata: BackupExportMetadata,
    pub proposals: Vec<proposals::SavedProposal>,
    pub settings: Vec<settings::Setting>,
    pub job_posts: Vec<JobPost>,
}

/// Metadata included in the backup file
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupExportMetadata {
    pub export_date: String,
    pub app_version: String,
    pub database_version: String,
    pub backup_type: String,
    pub proposal_count: usize,
    pub settings_count: usize,
    pub job_posts_count: usize,
}

/// Job post data structure (simplified for backup)
#[derive(Debug, Serialize, Deserialize)]
pub struct JobPost {
    pub id: i64,
    pub url: Option<String>,
    pub raw_content: String,
    pub client_name: Option<String>,
    pub created_at: String,
}

/// Create a pre-migration backup of all database data
///
/// This function performs an automated backup before SQLCipher migration:
/// 1. Generates timestamp-based filename
/// 2. Ensures backup directory exists
/// 3. Exports all tables to JSON
/// 4. Writes atomically (temp file → rename)
/// 5. Verifies backup is readable
///
/// # Arguments
/// * `app_data_dir` - Application data directory path
/// * `db` - Database instance to backup
///
/// # Returns
/// * `Ok(BackupMetadata)` - Metadata about the created backup
/// * `Err(BackupError)` - Error if backup creation or verification fails
///
/// # Example
/// ```ignore
/// let metadata = create_pre_migration_backup(&app_data_dir, &database)?;
/// println!("Backup created: {} proposals saved", metadata.proposal_count);
/// ```
pub fn create_pre_migration_backup(
    app_data_dir: &Path,
    db: &Database,
) -> Result<BackupMetadata, BackupError> {
    // Generate timestamp-based filename (Subtask 1.3)
    let timestamp = Utc::now().format("%Y-%m-%d-%H-%M-%S").to_string();
    let filename = format!("pre-encryption-backup-{}.json", timestamp);

    // Ensure backups directory exists (Subtask 1.4)
    let backups_dir = app_data_dir.join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|e| BackupError::DirectoryCreationFailed(e.to_string()))?;

    let backup_path = backups_dir.join(&filename);

    // Export all database tables (Task 2)
    let backup_data = export_database_to_backup(db)?;

    // Get counts for metadata
    let proposal_count = backup_data.proposals.len();
    let settings_count = backup_data.settings.len();
    let job_posts_count = backup_data.job_posts.len();

    // Write backup to file with verification (Task 3)
    write_and_verify_backup(&backup_path, &backup_data)?;

    // Return metadata (Subtask 1.5)
    Ok(BackupMetadata {
        file_path: backup_path,
        timestamp,
        proposal_count,
        settings_count,
        job_posts_count,
    })
}

/// Export all database tables to BackupData structure
fn export_database_to_backup(db: &Database) -> Result<BackupData, BackupError> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| BackupError::DatabaseLockError(e.to_string()))?;

    // Query all proposals (Subtask 2.1)
    let proposals = proposals::get_all_proposals(&conn)
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to query proposals: {}", e)))?;

    // Query all settings (Subtask 2.2)
    let settings = settings::list_settings(&conn)
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to query settings: {}", e)))?;

    // Query all job_posts (Subtask 2.3)
    let job_posts = query_all_job_posts(&conn)?;

    // Get database version from refinery migration history (Subtask 2.5)
    let database_version = get_database_version(&conn).unwrap_or_else(|_| "unknown".to_string());

    // Build backup metadata (Subtask 2.5)
    let metadata = BackupExportMetadata {
        export_date: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        database_version,
        backup_type: "pre-migration".to_string(),
        proposal_count: proposals.len(),
        settings_count: settings.len(),
        job_posts_count: job_posts.len(),
    };

    // Build complete backup structure (Subtask 2.4)
    Ok(BackupData {
        metadata,
        proposals,
        settings,
        job_posts,
    })
}

/// Query all job posts from database
fn query_all_job_posts(conn: &rusqlite::Connection) -> Result<Vec<JobPost>, BackupError> {
    let mut stmt = conn
        .prepare("SELECT id, url, raw_content, client_name, created_at FROM job_posts ORDER BY id ASC")
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to prepare job_posts query: {}", e)))?;

    let job_posts = stmt
        .query_map([], |row| {
            Ok(JobPost {
                id: row.get(0)?,
                url: row.get(1)?,
                raw_content: row.get(2)?,
                client_name: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to query job_posts: {}", e)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to map job_posts rows: {}", e)))?;

    Ok(job_posts)
}

/// Get database version from refinery migration history
fn get_database_version(conn: &rusqlite::Connection) -> Result<String, BackupError> {
    // Query the latest migration version from refinery's schema history table
    let version: String = conn
        .query_row(
            "SELECT version FROM refinery_schema_history ORDER BY version DESC LIMIT 1",
            [],
            |row| row.get(0)
        )
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to query migration version: {}", e)))?;

    Ok(format!("V{}", version))
}

/// Write backup to file atomically and verify
fn write_and_verify_backup(backup_path: &Path, backup_data: &BackupData) -> Result<(), BackupError> {
    // Serialize to JSON (Subtask 3.1)
    let json_content = serde_json::to_string_pretty(backup_data)
        .map_err(|e| BackupError::SerializationFailed(e.to_string()))?;

    // Atomic write: temp file → rename (Subtask 3.2)
    let temp_path = backup_path.with_extension("json.tmp");
    fs::write(&temp_path, &json_content)
        .map_err(|e| BackupError::FileWriteFailed(format!("Failed to write temp file: {}", e)))?;

    fs::rename(&temp_path, backup_path)
        .map_err(|e| BackupError::FileWriteFailed(format!("Failed to rename temp file: {}", e)))?;

    // Verify file exists and is readable (Subtask 3.3)
    if !backup_path.exists() {
        return Err(BackupError::VerificationFailed("Backup file does not exist after write".to_string()));
    }

    // Verify file size > 0 bytes (Subtask 3.4)
    let metadata = fs::metadata(backup_path)
        .map_err(|e| BackupError::VerificationFailed(format!("Cannot read file metadata: {}", e)))?;

    if metadata.len() == 0 {
        return Err(BackupError::VerificationFailed("Backup file is empty (0 bytes)".to_string()));
    }

    // Parse JSON from file to validate structure (Subtask 3.5)
    let file_content = fs::read_to_string(backup_path)
        .map_err(|e| BackupError::VerificationFailed(format!("Cannot read backup file: {}", e)))?;

    serde_json::from_str::<BackupData>(&file_content)
        .map_err(|e| BackupError::VerificationFailed(format!("Backup file contains invalid JSON: {}", e)))?;

    tracing::info!("Backup verified successfully: {}", backup_path.display());

    Ok(())
}

/// Restore database from backup file (Story 2.5, Task 3)
///
/// Reads a backup JSON file and restores all data to the unencrypted database.
/// Used for recovery when migration fails and automatic rollback is insufficient.
///
/// # Arguments
/// * `backup_path` - Path to the backup JSON file
/// * `db` - Database instance to restore data into
///
/// # Returns
/// * `Ok(usize)` - Total number of records restored
/// * `Err(BackupError)` - Error if restore fails
///
/// # Example
/// ```ignore
/// let records_restored = restore_from_backup(&backup_path, &database)?;
/// println!("Restored {} total records", records_restored);
/// ```
/// Export unencrypted backup to a user-specified file path (Story 2.9, Task 3).
///
/// Used from the Recovery Options screen to let users export their data
/// as an unencrypted JSON file before encryption setup.
///
/// # Arguments
/// * `db` - Database instance to export
/// * `file_path` - User-chosen file path for the export
///
/// # Returns
/// * `Ok(BackupMetadata)` - Metadata about the exported backup
/// * `Err(BackupError)` - Export failed
pub fn export_unencrypted_backup(
    db: &Database,
    file_path: &Path,
) -> Result<BackupMetadata, BackupError> {
    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| BackupError::DirectoryCreationFailed(e.to_string()))?;
    }

    // Export all database tables (reuse existing logic)
    let mut backup_data = export_database_to_backup(db)?;

    // Override backup_type for user-initiated export (AC3: "pre-encryption")
    backup_data.metadata.backup_type = "pre-encryption".to_string();

    let proposal_count = backup_data.proposals.len();
    let settings_count = backup_data.settings.len();
    let job_posts_count = backup_data.job_posts.len();

    // Write and verify
    write_and_verify_backup(file_path, &backup_data)?;

    tracing::info!("Unencrypted backup exported to: {}", file_path.display());

    Ok(BackupMetadata {
        file_path: file_path.to_path_buf(),
        timestamp: Utc::now().format("%Y-%m-%d-%H-%M-%S").to_string(),
        proposal_count,
        settings_count,
        job_posts_count,
    })
}

pub fn restore_from_backup(
    backup_path: &Path,
    db: &Database,
) -> Result<usize, BackupError> {
    tracing::info!("Starting restore from backup: {}", backup_path.display());

    // Subtask 3.1: Read backup JSON file
    if !backup_path.exists() {
        return Err(BackupError::VerificationFailed(format!(
            "Backup file not found: {}",
            backup_path.display()
        )));
    }

    let file_content = fs::read_to_string(backup_path)
        .map_err(|e| BackupError::FileWriteFailed(format!("Failed to read backup file: {}", e)))?;

    // Subtask 3.2: Parse JSON into BackupData structure
    let backup_data: BackupData = serde_json::from_str(&file_content)
        .map_err(|e| BackupError::SerializationFailed(format!("Failed to parse backup JSON: {}", e)))?;

    // Lock database connection for restoration
    let conn = db
        .conn
        .lock()
        .map_err(|e| BackupError::DatabaseLockError(e.to_string()))?;

    // Begin transaction for atomic restore
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to begin transaction: {}", e)))?;

    // Attempt to restore all data
    let restore_result = (|| -> Result<usize, BackupError> {
        let mut total_restored = 0;

        // Subtask 3.3: Clear existing data from tables
        conn.execute("DELETE FROM proposals", [])
            .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to clear proposals: {}", e)))?;

        conn.execute("DELETE FROM settings", [])
            .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to clear settings: {}", e)))?;

        conn.execute("DELETE FROM job_posts", [])
            .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to clear job_posts: {}", e)))?;

        // Subtask 3.4: Insert proposals from backup
        for proposal in &backup_data.proposals {
            conn.execute(
                "INSERT INTO proposals (id, job_content, generated_text, status, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    proposal.id,
                    proposal.job_content,
                    proposal.generated_text,
                    proposal.status,
                    proposal.created_at,
                ],
            )
            .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to insert proposal: {}", e)))?;
            total_restored += 1;
        }

        // Subtask 3.5: Insert settings from backup
        for setting in &backup_data.settings {
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                rusqlite::params![setting.key, setting.value],
            )
            .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to insert setting: {}", e)))?;
            total_restored += 1;
        }

        // Subtask 3.6: Insert job_posts from backup
        for job_post in &backup_data.job_posts {
            conn.execute(
                "INSERT INTO job_posts (id, url, raw_content, client_name, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    job_post.id,
                    job_post.url,
                    job_post.raw_content,
                    job_post.client_name,
                    job_post.created_at,
                ],
            )
            .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to insert job_post: {}", e)))?;
            total_restored += 1;
        }

        Ok(total_restored)
    })();

    // Subtask 3.7: Commit or rollback based on result
    match restore_result {
        Ok(count) => {
            conn.execute("COMMIT", [])
                .map_err(|e| BackupError::DatabaseQueryFailed(format!("Failed to commit restore: {}", e)))?;

            tracing::info!(
                "Restore completed successfully: {} records restored from {}",
                count,
                backup_path.display()
            );

            Ok(count)
        }
        Err(e) => {
            conn.execute("ROLLBACK", [])
                .map_err(|rollback_err| {
                    BackupError::DatabaseQueryFailed(format!("Rollback failed: {}", rollback_err))
                })?;

            tracing::error!("Restore failed: {}", e);
            Err(e)
        }
    }
}
