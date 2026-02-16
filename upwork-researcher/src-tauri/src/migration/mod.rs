//! Database migration module for SQLite → SQLCipher migration (Story 2.3)
//!
//! Provides atomic migration from unencrypted SQLite to encrypted SQLCipher database.
//! Uses ATTACH DATABASE approach for single-transaction migration.
//!
//! Key features:
//! - Atomic migration (all-or-nothing with single transaction)
//! - ATTACH DATABASE for cross-database operations
//! - Verification of row counts after migration
//! - Rollback and backup restore on failure
//! - Migration marker file prevents re-migration

#[cfg(test)]
mod tests;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::db::Database;
use crate::passphrase;

/// Errors that can occur during migration operations (Story 2.5 enhanced)
#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("Failed to open old database: {0}. Your data is safe and unchanged.")]
    OldDatabaseOpenFailed(String),

    #[error("Failed to create new encrypted database: {0}. Your data is safe and unchanged.")]
    NewDatabaseCreationFailed(String),

    #[error("Failed to derive encryption key: {0}. Your data is safe and unchanged.")]
    KeyDerivationFailed(String),

    #[error("Failed to attach old database: {0}. Your data is safe and unchanged.")]
    AttachFailed(String),

    #[error("Failed to copy data: {0}. Migration rolled back, your data is safe.")]
    CopyFailed(String),

    #[error("Data verification failed: {0}. Migration rolled back, your data is safe.")]
    VerificationFailed(String),

    #[error(
        "Failed to create migration marker: {0}. Encrypted database created but not activated."
    )]
    MarkerCreationFailed(String),

    #[error("Failed to rename old database: {0}. Encrypted database created but not activated.")]
    RenameFailed(String),

    #[error("Backup restore failed: {0}. Manual intervention required.")]
    RestoreFailed(String),

    #[error("Database lock error: {0}. Your data is safe.")]
    DatabaseLockError(String),

    #[error("IO error: {0}. Your data is safe.")]
    IoError(String),

    #[error("Disk space insufficient: {0}. Your data is safe and unchanged.")]
    DiskSpaceError(String),

    #[error("Transaction commit failed: {0}. Migration rolled back, your data is safe.")]
    TransactionFailed(String),
}

/// Metadata about a completed migration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationMetadata {
    pub old_db_path: PathBuf,
    pub new_db_path: PathBuf,
    pub backup_path: PathBuf,
    pub timestamp: String,
    pub duration_ms: u64,
    pub proposals_count: usize,
    pub settings_count: usize,
    pub job_posts_count: usize,
    pub refinery_history_count: usize,
}

/// Verification data for post-migration UI (Story 2.4)
///
/// Provides user with counts and paths to verify migration success
/// before deciding to delete unencrypted database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationVerification {
    pub proposals_count: usize,
    pub settings_count: usize,
    pub job_posts_count: usize,
    pub backup_path: String,
    pub old_db_path: String,
}

/// Row counts for verification
#[derive(Debug, Clone)]
struct RowCounts {
    proposals: usize,
    settings: usize,
    job_posts: usize,
    refinery_history: usize,
}

/// Migrate unencrypted SQLite database to encrypted SQLCipher database
///
/// This function performs an atomic migration using ATTACH DATABASE:
/// 1. Creates new encrypted SQLCipher database
/// 2. Runs migrations on new database (schema creation)
/// 3. Attaches old unencrypted database
/// 4. Copies all data in single transaction
/// 5. Verifies row counts match
/// 6. Renames old database to .old extension
/// 7. Creates migration marker file
///
/// # Arguments
/// * `app_data_dir` - Application data directory path
/// * `passphrase` - User passphrase for encryption key derivation
/// * `backup_path` - Path to backup file for restore if migration fails
///
/// # Returns
/// * `Ok(MigrationMetadata)` - Metadata about successful migration
/// * `Err(MigrationError)` - Error if migration fails at any step
///
/// # Example
/// ```ignore
/// let metadata = migrate_to_encrypted_database(&app_data_dir, &passphrase, &backup_path)?;
/// println!("Migrated {} proposals in {}ms", metadata.proposals_count, metadata.duration_ms);
/// ```
pub fn migrate_to_encrypted_database(
    app_data_dir: &Path,
    passphrase: &str,
    backup_path: &Path,
) -> Result<MigrationMetadata, MigrationError> {
    let start_time = Instant::now();

    // Define database paths
    let old_db_path = app_data_dir.join("upwork-researcher.db");
    let new_db_path = app_data_dir.join("upwork-researcher-encrypted.db");

    tracing::info!(
        "Starting migration from {} to {}",
        old_db_path.display(),
        new_db_path.display()
    );

    // Verify old database exists
    if !old_db_path.exists() {
        return Err(MigrationError::OldDatabaseOpenFailed(
            "Old database file does not exist".to_string(),
        ));
    }

    // Subtask 1.3: Open old unencrypted database
    let old_conn = rusqlite::Connection::open(&old_db_path)
        .map_err(|e| MigrationError::OldDatabaseOpenFailed(e.to_string()))?;

    // Subtask 1.4: Create new SQLCipher database with derived Argon2id key
    // Use verify_passphrase which loads salt and derives key
    // TD-3: Key wrapped in Zeroizing — extract via std::mem::take, Database::new re-wraps
    let mut encryption_key = passphrase::verify_passphrase(passphrase, app_data_dir)
        .map_err(|e| MigrationError::KeyDerivationFailed(e.to_string()))?;

    // Create new encrypted database with key
    let new_db = Database::new(
        new_db_path.clone(),
        Some(std::mem::take(&mut *encryption_key)),
    )
    .map_err(|e| MigrationError::NewDatabaseCreationFailed(e.to_string()))?;

    // Lock new database connection for migration
    let new_conn = new_db
        .conn
        .lock()
        .map_err(|e| MigrationError::DatabaseLockError(e.to_string()))?;

    // Subtask 1.6: ATTACH old database to new encrypted connection
    // SQLCipher requires explicit KEY specification for attached databases
    let attach_sql = format!(
        "ATTACH DATABASE '{}' AS old_db KEY ''",
        old_db_path.display()
    );
    new_conn.execute(&attach_sql, []).map_err(|e| {
        MigrationError::AttachFailed(format!("Failed to attach old database: {}", e))
    })?;

    tracing::info!("Attached old database for migration");

    // Copy data in transaction and verify
    let row_counts = copy_data_atomic(&new_conn, &old_conn)?;

    // Subtask 3.6: DETACH old database after successful copy
    new_conn
        .execute("DETACH DATABASE old_db", [])
        .map_err(|e| MigrationError::CopyFailed(format!("Failed to detach old database: {}", e)))?;

    // Checkpoint WAL to ensure all changes are flushed to main database file
    old_conn
        .execute("PRAGMA wal_checkpoint(TRUNCATE)", [])
        .map_err(|e| {
            tracing::warn!("Failed to checkpoint old database WAL: {}", e);
            // Not fatal - continue anyway
        })
        .ok();

    // Switch old database from WAL to DELETE mode to remove WAL files
    old_conn
        .execute("PRAGMA journal_mode=DELETE", [])
        .map_err(|e| {
            tracing::warn!("Failed to switch old database journal mode: {}", e);
        })
        .ok();

    // Close old connection before renaming
    drop(old_conn);

    // Also checkpoint new database WAL
    new_conn
        .execute("PRAGMA wal_checkpoint(TRUNCATE)", [])
        .map_err(|e| {
            tracing::warn!("Failed to checkpoint new database WAL: {}", e);
        })
        .ok();

    drop(new_conn);
    drop(new_db);

    // Clean up WAL/SHM files if they exist
    let old_wal = old_db_path.with_extension("db-wal");
    let old_shm = old_db_path.with_extension("db-shm");
    if old_wal.exists() {
        fs::remove_file(&old_wal).ok();
    }
    if old_shm.exists() {
        fs::remove_file(&old_shm).ok();
    }

    // Subtask 4.1: Rename old database to .old extension
    let old_db_backup_path = old_db_path.with_extension("db.old");
    fs::rename(&old_db_path, &old_db_backup_path).map_err(|e| {
        MigrationError::RenameFailed(format!("Failed to rename old database: {}", e))
    })?;

    // Rename new encrypted database to primary name
    let final_db_path = app_data_dir.join("upwork-researcher.db");
    fs::rename(&new_db_path, &final_db_path).map_err(|e| {
        MigrationError::RenameFailed(format!("Failed to rename new database: {}", e))
    })?;

    // Subtask 4.2: Create migration marker file
    create_migration_marker(app_data_dir)?;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    // Subtask 4.3: Return MigrationMetadata
    let metadata = MigrationMetadata {
        old_db_path: old_db_backup_path,
        new_db_path: final_db_path,
        backup_path: backup_path.to_path_buf(),
        timestamp: Utc::now().to_rfc3339(),
        duration_ms,
        proposals_count: row_counts.proposals,
        settings_count: row_counts.settings,
        job_posts_count: row_counts.job_posts,
        refinery_history_count: row_counts.refinery_history,
    };

    // Subtask 4.4: Log migration success
    tracing::info!(
        "Migration completed successfully in {}ms: {} proposals, {} settings, {} job_posts",
        duration_ms,
        row_counts.proposals,
        row_counts.settings,
        row_counts.job_posts
    );

    Ok(metadata)
}

/// Copy all data from old_db to new encrypted database in single atomic transaction
/// (Task 2: Atomic table copy, Task 3: Verification)
fn copy_data_atomic(
    new_conn: &rusqlite::Connection,
    old_conn: &rusqlite::Connection,
) -> Result<RowCounts, MigrationError> {
    // Subtask 2.1: Begin explicit EXCLUSIVE transaction
    new_conn
        .execute("BEGIN EXCLUSIVE TRANSACTION", [])
        .map_err(|e| MigrationError::CopyFailed(format!("Failed to begin transaction: {}", e)))?;

    // Attempt to copy all tables - rollback on any failure
    let copy_result = (|| {
        // Subtask 2.2: Copy proposals (explicit columns to handle schema evolution)
        new_conn.execute(
            "INSERT INTO proposals (id, job_content, generated_text, created_at, updated_at, status)
             SELECT id, job_content, generated_text, created_at, updated_at,
                    COALESCE(status, 'completed')
             FROM old_db.proposals",
            []
        )
        .map_err(|e| MigrationError::CopyFailed(format!("Failed to copy proposals: {}", e)))?;

        // Subtask 2.3: Copy settings (use REPLACE to handle default settings from migrations)
        new_conn
            .execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at)
             SELECT key, value, updated_at FROM old_db.settings",
                [],
            )
            .map_err(|e| MigrationError::CopyFailed(format!("Failed to copy settings: {}", e)))?;

        // Subtask 2.4: Copy job_posts
        new_conn
            .execute(
                "INSERT INTO job_posts (id, url, raw_content, client_name, created_at)
             SELECT id, url, raw_content, client_name, created_at FROM old_db.job_posts",
                [],
            )
            .map_err(|e| MigrationError::CopyFailed(format!("Failed to copy job_posts: {}", e)))?;

        // Subtask 2.5: Copy refinery_schema_history (use REPLACE to handle migrations already run)
        new_conn.execute(
            "INSERT OR REPLACE INTO refinery_schema_history (version, name, applied_on, checksum)
             SELECT version, name, applied_on, checksum FROM old_db.refinery_schema_history",
            []
        )
        .map_err(|e| MigrationError::CopyFailed(format!("Failed to copy refinery_schema_history: {}", e)))?;

        Ok::<(), MigrationError>(())
    })();

    // Subtask 2.7: If any INSERT fails, ROLLBACK transaction (Story 2.5)
    if let Err(e) = copy_result {
        tracing::error!("Copy failed, executing rollback: {}", e);
        new_conn.execute("ROLLBACK", []).map_err(|rollback_err| {
            MigrationError::CopyFailed(format!("Rollback failed: {}", rollback_err))
        })?;

        // Verify old database is still intact after rollback
        tracing::info!("Verifying old database integrity after rollback");
        verify_old_database_intact(old_conn)?;

        return Err(e);
    }

    // Subtask 2.6: Commit transaction (all-or-nothing)
    new_conn.execute("COMMIT", []).map_err(|e| {
        tracing::error!("Transaction commit failed: {}", e);
        MigrationError::TransactionFailed(format!("Failed to commit transaction: {}", e))
    })?;

    // Task 3: Verify data integrity after migration
    verify_migration_counts(new_conn, old_conn)
}

/// Verify row counts match between old and new databases (Subtasks 3.1-3.5)
fn verify_migration_counts(
    new_conn: &rusqlite::Connection,
    _old_conn: &rusqlite::Connection,
) -> Result<RowCounts, MigrationError> {
    // Query counts from new encrypted database
    let new_proposals: usize = new_conn
        .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
        .map_err(|e| {
            MigrationError::VerificationFailed(format!("Failed to count new proposals: {}", e))
        })?;

    let new_settings: usize = new_conn
        .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
        .map_err(|e| {
            MigrationError::VerificationFailed(format!("Failed to count new settings: {}", e))
        })?;

    let new_job_posts: usize = new_conn
        .query_row("SELECT COUNT(*) FROM job_posts", [], |row| row.get(0))
        .map_err(|e| {
            MigrationError::VerificationFailed(format!("Failed to count new job_posts: {}", e))
        })?;

    let new_refinery: usize = new_conn
        .query_row("SELECT COUNT(*) FROM refinery_schema_history", [], |row| {
            row.get(0)
        })
        .map_err(|e| {
            MigrationError::VerificationFailed(format!(
                "Failed to count new refinery_schema_history: {}",
                e
            ))
        })?;

    // Query counts from old database via ATTACH
    let old_proposals: usize = new_conn
        .query_row("SELECT COUNT(*) FROM old_db.proposals", [], |row| {
            row.get(0)
        })
        .map_err(|e| {
            MigrationError::VerificationFailed(format!("Failed to count old proposals: {}", e))
        })?;

    let old_settings: usize = new_conn
        .query_row("SELECT COUNT(*) FROM old_db.settings", [], |row| row.get(0))
        .map_err(|e| {
            MigrationError::VerificationFailed(format!("Failed to count old settings: {}", e))
        })?;

    let old_job_posts: usize = new_conn
        .query_row("SELECT COUNT(*) FROM old_db.job_posts", [], |row| {
            row.get(0)
        })
        .map_err(|e| {
            MigrationError::VerificationFailed(format!("Failed to count old job_posts: {}", e))
        })?;

    let old_refinery: usize = new_conn
        .query_row(
            "SELECT COUNT(*) FROM old_db.refinery_schema_history",
            [],
            |row| row.get(0),
        )
        .map_err(|e| {
            MigrationError::VerificationFailed(format!(
                "Failed to count old refinery_schema_history: {}",
                e
            ))
        })?;

    // Subtask 3.5: Compare all counts - if mismatch, return verification error
    if new_proposals != old_proposals {
        return Err(MigrationError::VerificationFailed(format!(
            "Proposals count mismatch: old={}, new={}",
            old_proposals, new_proposals
        )));
    }

    if new_settings != old_settings {
        return Err(MigrationError::VerificationFailed(format!(
            "Settings count mismatch: old={}, new={}",
            old_settings, new_settings
        )));
    }

    if new_job_posts != old_job_posts {
        return Err(MigrationError::VerificationFailed(format!(
            "Job posts count mismatch: old={}, new={}",
            old_job_posts, new_job_posts
        )));
    }

    // New DB may have additional migrations applied after data copy, so
    // new_refinery >= old_refinery is the correct invariant.
    if new_refinery < old_refinery {
        return Err(MigrationError::VerificationFailed(format!(
            "Refinery history count mismatch: old={}, new={}",
            old_refinery, new_refinery
        )));
    }

    tracing::info!(
        "Verification passed: {} proposals, {} settings, {} job_posts, {} refinery entries",
        new_proposals,
        new_settings,
        new_job_posts,
        new_refinery
    );

    Ok(RowCounts {
        proposals: new_proposals,
        settings: new_settings,
        job_posts: new_job_posts,
        refinery_history: new_refinery,
    })
}

/// Verify old database is still intact after rollback (Story 2.5, Task 2)
///
/// Queries the old database to ensure it's readable and contains data.
/// This confirms that rollback was successful and user data is safe.
fn verify_old_database_intact(old_conn: &rusqlite::Connection) -> Result<(), MigrationError> {
    // Verify database is readable by counting rows in each table
    let proposals_count: Result<i64, _> =
        old_conn.query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0));

    let settings_count: Result<i64, _> =
        old_conn.query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0));

    let job_posts_count: Result<i64, _> =
        old_conn.query_row("SELECT COUNT(*) FROM job_posts", [], |row| row.get(0));

    // If any query fails, database is corrupted
    if proposals_count.is_err() || settings_count.is_err() || job_posts_count.is_err() {
        tracing::error!("Old database verification failed - database may be corrupted");
        return Err(MigrationError::VerificationFailed(
            "Old database is not readable after rollback. Please restore from backup.".to_string(),
        ));
    }

    tracing::info!(
        "Old database verified intact after rollback: {} proposals, {} settings, {} job_posts",
        proposals_count.unwrap(),
        settings_count.unwrap(),
        job_posts_count.unwrap()
    );

    Ok(())
}

/// Create migration marker file (Subtask 4.2)
fn create_migration_marker(app_data_dir: &Path) -> Result<(), MigrationError> {
    let marker_path = app_data_dir.join(".migration_complete");
    let timestamp = Utc::now().to_rfc3339();

    fs::write(&marker_path, timestamp)
        .map_err(|e| MigrationError::MarkerCreationFailed(e.to_string()))?;

    tracing::info!("Created migration marker: {}", marker_path.display());
    Ok(())
}

/// Check if migration has already been completed
pub fn is_migration_complete(app_data_dir: &Path) -> bool {
    app_data_dir.join(".migration_complete").exists()
}

/// Clean up incomplete encrypted database on migration failure (Story 2-5)
///
/// Removes the partially created encrypted database file to prevent corruption.
pub fn cleanup_failed_migration(app_data_dir: &Path) {
    let new_db_path = app_data_dir.join("upwork-researcher-encrypted.db");

    if new_db_path.exists() {
        match fs::remove_file(&new_db_path) {
            Ok(_) => tracing::warn!(
                "Cleaned up incomplete encrypted database: {}",
                new_db_path.display()
            ),
            Err(e) => tracing::error!("Failed to clean up incomplete encrypted database: {}", e),
        }
    }
}

/// Delete old unencrypted database file (Story 2.4, Task 2)
///
/// Permanently removes the .old database file after user confirms
/// they're satisfied with migration verification.
///
/// # Arguments
/// * `old_db_path` - Path to the .old database file to delete
///
/// # Returns
/// * Success message with deleted path
/// * Error if file doesn't exist or deletion fails
pub fn delete_old_database(old_db_path: &str) -> Result<String, MigrationError> {
    let path = Path::new(old_db_path);

    // Subtask 2.2: Verify .old file exists
    if !path.exists() {
        return Err(MigrationError::IoError(format!(
            "Old database file not found: {}",
            old_db_path
        )));
    }

    // Subtask 2.3: Delete .old database
    fs::remove_file(path)
        .map_err(|e| MigrationError::IoError(format!("Failed to delete old database: {}", e)))?;

    // Subtask 2.5: Log deletion
    tracing::info!("Deleted unencrypted database: {}", old_db_path);

    // Subtask 2.4: Return success message
    Ok(format!(
        "Unencrypted database deleted successfully: {}",
        old_db_path
    ))
}

/// Get verification data for post-migration UI (Story 2.4, Task 3)
///
/// Queries encrypted database for current counts and constructs paths
/// for user verification before deletion of old database.
///
/// # Arguments
/// * `database` - Encrypted database connection
/// * `app_data_dir` - Application data directory for path construction
///
/// # Returns
/// * MigrationVerification with counts and paths for UI display
pub fn get_migration_verification(
    database: &Database,
    app_data_dir: &Path,
) -> Result<MigrationVerification, MigrationError> {
    // Subtask 3.2: Query encrypted database for current counts
    let proposals_count = database.query_proposals_count().map_err(|e| {
        MigrationError::VerificationFailed(format!("Failed to query proposals: {}", e))
    })?;

    let settings_count = database.query_settings_count().map_err(|e| {
        MigrationError::VerificationFailed(format!("Failed to query settings: {}", e))
    })?;

    let job_posts_count = database.query_job_posts_count().map_err(|e| {
        MigrationError::VerificationFailed(format!("Failed to query job_posts: {}", e))
    })?;

    // Subtask 3.3: Read backup path from last backup location
    // Note: Using default pattern since backup path isn't stored in marker
    let backups_dir = app_data_dir.join("backups");
    let backup_path = if backups_dir.exists() {
        // Find most recent backup file
        fs::read_dir(&backups_dir)
            .ok()
            .and_then(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.file_name()
                            .to_str()
                            .map(|s| s.starts_with("pre-encryption-backup-"))
                            .unwrap_or(false)
                    })
                    .max_by_key(|e| e.metadata().ok().and_then(|m| m.modified().ok()))
            })
            .map(|e| e.path().to_string_lossy().to_string())
            .unwrap_or_else(|| backups_dir.to_string_lossy().to_string())
    } else {
        backups_dir.to_string_lossy().to_string()
    };

    // Subtask 3.4: Construct .old database path from current database path
    let old_db_path = app_data_dir
        .join("upwork-researcher.db.old")
        .to_string_lossy()
        .to_string();

    // Subtask 3.5: Return MigrationVerification with all data
    Ok(MigrationVerification {
        proposals_count,
        settings_count,
        job_posts_count,
        backup_path,
        old_db_path,
    })
}
