//! Database module for SQLite connection management.
//!
//! Provides thread-safe database access via Mutex<Connection>.
//! For MVP (Epic 1), uses unencrypted SQLite. Epic 2 adds SQLCipher encryption.

pub mod queries;

use refinery::embed_migrations;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

// Embed migrations from the migrations directory
embed_migrations!("migrations");

/// Database error types for Story 2.7 (encrypted database access on restart)
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Incorrect passphrase - database cannot be decrypted")]
    IncorrectPassphrase,

    #[error("Passphrase error: {0}")]
    PassphraseError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Database corrupted or incompatible: {0}")]
    CorruptedDatabase(String),
}

/// Database state wrapper for Tauri managed state.
/// Provides thread-safe access to the SQLite connection.
pub struct Database {
    pub conn: Mutex<Connection>,
    pub path: PathBuf,
}

impl Database {
    /// Initialize database at the given path.
    /// Creates the database file if it doesn't exist.
    /// Enables WAL mode and runs migrations.
    ///
    /// # Arguments
    /// * `db_path` - Path to the database file
    /// * `encryption_key` - Optional 32-byte encryption key for SQLCipher (Story 2.1)
    ///
    /// # Epic 2 Migration Notes
    /// - Epic 1 (unencrypted): Call with `None` for encryption_key
    /// - Epic 2 (encrypted): Call with `Some(key)` from Argon2id derivation
    /// - SQLCipher 4.10 with AES-256 encryption (AR-2, NFR-7)
    pub fn new(db_path: PathBuf, encryption_key: Option<Vec<u8>>) -> Result<Self, String> {
        // Open or create the database file
        let mut conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        // If encryption key provided, set up SQLCipher (Story 2.1, Epic 2)
        if let Some(key) = encryption_key {
            // Validate key length (32 bytes for AES-256)
            if key.len() != 32 {
                return Err(format!(
                    "Invalid encryption key length: expected 32 bytes, got {}",
                    key.len()
                ));
            }

            // Convert key to hex string for PRAGMA key
            let key_hex = hex::encode(&key);

            // Set encryption key (must be first operation after open)
            conn.execute_batch(&format!("PRAGMA key = \"x'{}'\"", key_hex))
                .map_err(|e| format!("Failed to set encryption key: {}", e))?;

            // Set SQLCipher compatibility version (4.x)
            conn.execute_batch("PRAGMA cipher_compatibility = 4;")
                .map_err(|e| format!("Failed to set cipher compatibility: {}", e))?;

            tracing::info!("SQLCipher encryption enabled (AES-256)");
        } else {
            tracing::warn!("Database opened WITHOUT encryption (Epic 1 compatibility mode)");
        }

        // Enable WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

        // Run migrations
        migrations::runner()
            .run(&mut conn)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;

        Ok(Self {
            conn: Mutex::new(conn),
            path: db_path,
        })
    }

    /// Check if the database connection is healthy.
    pub fn health_check(&self) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute_batch("SELECT 1;")
            .map_err(|e| format!("Health check failed: {}", e))?;
        Ok(true)
    }

    /// Get the database file path.
    pub fn get_path(&self) -> &PathBuf {
        &self.path
    }

    /// Query proposals count (Story 2.4)
    pub fn query_proposals_count(&self) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let count: usize = conn
            .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
            .map_err(|e| format!("Query failed: {}", e))?;
        Ok(count)
    }

    /// Query settings count (Story 2.4)
    pub fn query_settings_count(&self) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let count: usize = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .map_err(|e| format!("Query failed: {}", e))?;
        Ok(count)
    }

    /// Query job_posts count (Story 2.4)
    pub fn query_job_posts_count(&self) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let count: usize = conn
            .query_row("SELECT COUNT(*) FROM job_posts", [], |row| row.get(0))
            .map_err(|e| format!("Query failed: {}", e))?;
        Ok(count)
    }
}

/// Open encrypted database with passphrase verification (Story 2.7)
///
/// High-level function for app restart flow that:
/// 1. Derives encryption key from passphrase using Argon2id
/// 2. Opens encrypted database with derived key
/// 3. Validates key correctness via test query
/// 4. Returns DatabaseError::IncorrectPassphrase if key invalid
///
/// # Arguments
/// * `app_data_dir` - App data directory containing .salt file and database
/// * `passphrase` - User's passphrase for decryption
///
/// # Story 2.7 Context
/// - Task 2.1: Encrypted database open with passphrase
/// - AC-2: Derives key via Argon2id with stored salt
/// - AC-3: Opens database if passphrase correct
/// - AC-4: Returns error for incorrect passphrase
///
/// # Returns
/// - `Ok(Database)` - Database unlocked successfully
/// - `Err(DatabaseError::IncorrectPassphrase)` - Passphrase incorrect, retry
/// - `Err(DatabaseError::PassphraseError)` - Salt file missing or derivation failed
/// - `Err(DatabaseError::CorruptedDatabase)` - Database file corrupted
pub fn open_encrypted_database(app_data_dir: &Path, passphrase: &str) -> Result<Database, DatabaseError> {
    use crate::passphrase;

    // Subtask 2.2: Call verify_passphrase_and_derive_key() to get encryption key
    let encryption_key = passphrase::verify_passphrase_and_derive_key(passphrase, app_data_dir)
        .map_err(|e| DatabaseError::PassphraseError(e.to_string()))?;

    // Subtask 2.3: Call Database::new() with derived key
    // Subtask 2.4-2.5: Key validation happens implicitly — Database::new() runs PRAGMAs
    // (journal_mode, foreign_keys) and migrations against the encrypted database.
    // If the key is wrong, SQLCipher fails to decrypt the database header, causing
    // "file is not a database" errors during these operations.
    let db_path = app_data_dir.join("upwork-researcher.db");
    let db = Database::new(db_path, Some(encryption_key))
        .map_err(|e| {
            // Check for SQLCipher-specific errors indicating incorrect key
            if e.contains("file is not a database") || e.contains("database disk image is malformed") {
                DatabaseError::IncorrectPassphrase
            } else {
                DatabaseError::DatabaseError(e)
            }
        })?;

    // If we reach here, Database::new() succeeded — PRAGMAs and migrations all passed,
    // which confirms the encryption key is correct. No additional test query needed.
    tracing::info!("Encrypted database opened successfully with correct passphrase");

    // Subtask 2.6: Return Database on success
    Ok(db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_database_creation() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path.clone(), None).unwrap();

        assert!(db_path.exists());
        assert!(db.health_check().is_ok());
    }

    #[test]
    fn test_wal_mode_enabled() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .unwrap();

        assert_eq!(journal_mode.to_lowercase(), "wal");
    }

    #[test]
    fn test_get_path() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path.clone(), None).unwrap();

        assert_eq!(db.get_path(), &db_path);
    }

    #[test]
    fn test_migrations_create_proposals_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that proposals table exists
        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='proposals'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1);
    }

    #[test]
    fn test_proposals_table_has_correct_columns() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get column info
        let mut stmt = conn.prepare("PRAGMA table_info(proposals)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(columns.contains(&"id".to_string()));
        assert!(columns.contains(&"job_content".to_string()));
        assert!(columns.contains(&"generated_text".to_string()));
        assert!(columns.contains(&"created_at".to_string()));
        assert!(columns.contains(&"updated_at".to_string()));
    }

    #[test]
    fn test_proposals_table_has_created_at_index() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that index exists
        let index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_proposals_created_at'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_exists, 1);
    }

    #[test]
    fn test_migrations_create_settings_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that settings table exists
        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1);
    }

    #[test]
    fn test_settings_table_has_correct_columns() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get column info
        let mut stmt = conn.prepare("PRAGMA table_info(settings)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(columns.contains(&"key".to_string()));
        assert!(columns.contains(&"value".to_string()));
        assert!(columns.contains(&"updated_at".to_string()));
    }

    #[test]
    fn test_settings_table_seeded_with_defaults() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that default settings exist
        let settings_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();

        assert!(settings_count >= 2); // At least theme and api_provider
    }

    #[test]
    fn test_migrations_are_idempotent() {
        // Story 1.11 AC-2: Verify migrations can run multiple times safely
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // Run migrations first time
        let db1 = Database::new(db_path.clone(), None).unwrap();
        drop(db1);

        // Run migrations second time - should not fail
        let db2 = Database::new(db_path.clone(), None).unwrap();
        let conn = db2.conn.lock().unwrap();

        // Verify tables still exist and data is intact
        let proposals_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='proposals'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let settings_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(proposals_count, 1);
        assert_eq!(settings_count, 1);
    }

    #[test]
    fn test_migration_history_tracked() {
        // Story 1.11 AC-2: Verify migration history in schema table
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that refinery's history table exists
        let history_table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='refinery_schema_history'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(history_table_exists, 1);

        // Check that migrations are recorded
        let migrations_applied: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM refinery_schema_history",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(migrations_applied >= 2); // At least V1 and V2
    }

    #[test]
    fn test_migration_error_logging() {
        // Story 1.11 AC-3: Verify migration errors are properly reported
        // This test uses an intentionally invalid path to trigger an error
        use std::path::Path;

        let invalid_path = Path::new("/invalid/nonexistent/path/test.db");
        let result = Database::new(invalid_path.to_path_buf(), None);

        // Should return error message
        assert!(result.is_err());
        if let Err(error_msg) = result {
            assert!(error_msg.contains("Failed to open database") || error_msg.contains("unable to open"));
        }
    }

    #[test]
    fn test_migrations_create_job_posts_table() {
        // Story 1.12 AC-1: Verify job_posts table is created
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that job_posts table exists
        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='job_posts'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1);
    }

    #[test]
    fn test_job_posts_table_has_correct_columns() {
        // Story 1.12 AC-1: Verify job_posts table has correct schema
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get column info
        let mut stmt = conn.prepare("PRAGMA table_info(job_posts)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(columns.contains(&"id".to_string()));
        assert!(columns.contains(&"url".to_string()));
        assert!(columns.contains(&"raw_content".to_string()));
        assert!(columns.contains(&"client_name".to_string()));
        assert!(columns.contains(&"created_at".to_string()));
    }

    #[test]
    fn test_job_posts_table_has_created_at_index() {
        // Story 1.12 AC-3: Verify created_at index exists for performance
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that index exists
        let index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_posts_created_at'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_exists, 1);
    }

    #[test]
    fn test_job_posts_table_has_url_index() {
        // Story 1.12 AC-3: Verify url index exists for duplicate detection
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that index exists
        let index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_posts_url'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_exists, 1);
    }

    // ====================
    // Story 2.7 Tests: Encrypted Database Access on App Restart
    // ====================

    #[test]
    fn test_open_encrypted_database_correct_passphrase() {
        // Task 9.1 (partial): End-to-end test with correct passphrase
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase = "CorrectTestPass123!";

        // Setup: Create encrypted database (Story 2-1 flow)
        let _key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();

        // Create database with encryption
        let db_path = dir.path().join("upwork-researcher.db");
        let encryption_key = passphrase::verify_passphrase(passphrase, dir.path()).unwrap();
        let _db = Database::new(db_path, Some(encryption_key)).unwrap();

        // Story 2.7: Open encrypted database on restart
        let result = open_encrypted_database(dir.path(), passphrase);

        assert!(result.is_ok());
        let db = result.unwrap();
        assert!(db.health_check().is_ok());
    }

    #[test]
    fn test_open_encrypted_database_incorrect_passphrase() {
        // Task 9.2 (partial): Test incorrect passphrase returns IncorrectPassphrase error
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let correct_passphrase = "CorrectTestPass123!";
        let wrong_passphrase = "WrongPassword456!";

        // Setup: Create encrypted database with correct passphrase
        let _key = passphrase::set_passphrase(correct_passphrase, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let encryption_key = passphrase::verify_passphrase(correct_passphrase, dir.path()).unwrap();
        let _db = Database::new(db_path, Some(encryption_key)).unwrap();

        // Story 2.7: Try to open with wrong passphrase
        let result = open_encrypted_database(dir.path(), wrong_passphrase);

        assert!(result.is_err());
        match result {
            Err(DatabaseError::IncorrectPassphrase) => {}, // Expected
            Err(e) => panic!("Expected IncorrectPassphrase, got: {:?}", e),
            Ok(_) => panic!("Expected error, got success"),
        }
    }

    #[test]
    fn test_open_encrypted_database_salt_missing() {
        // Task 8.3: Test salt file missing returns PassphraseError
        let dir = tempdir().unwrap();
        let passphrase = "TestPassphrase123!";

        // No salt file created - should fail
        let result = open_encrypted_database(dir.path(), passphrase);

        assert!(result.is_err());
        match result {
            Err(DatabaseError::PassphraseError(_)) => {}, // Expected
            Err(e) => panic!("Expected PassphraseError, got: {:?}", e),
            Ok(_) => panic!("Expected error, got success"),
        }
    }

    #[test]
    fn test_open_encrypted_database_validates_key() {
        // Task 2.4: Verify test query validates encryption key
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase = "ValidateKeyTest123!";

        // Setup encrypted database
        let _key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let encryption_key = passphrase::verify_passphrase(passphrase, dir.path()).unwrap();
        let _db = Database::new(db_path, Some(encryption_key)).unwrap();

        // Open and validate
        let result = open_encrypted_database(dir.path(), passphrase);
        assert!(result.is_ok());

        // Verify database is functional
        let db = result.unwrap();
        assert_eq!(db.query_proposals_count().unwrap(), 0); // Empty table
    }

    #[test]
    fn test_open_encrypted_database_retry_flow() {
        // Task 9.2: Test incorrect passphrase → retry → correct passphrase flow
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let correct_passphrase = "RetryFlowTest123!";
        let wrong_passphrase = "WrongPassword456!";

        // Setup encrypted database
        let _key = passphrase::set_passphrase(correct_passphrase, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let encryption_key = passphrase::verify_passphrase(correct_passphrase, dir.path()).unwrap();
        let _db = Database::new(db_path, Some(encryption_key)).unwrap();

        // Attempt 1: Wrong passphrase → should fail
        let result1 = open_encrypted_database(dir.path(), wrong_passphrase);
        assert!(result1.is_err());
        match result1 {
            Err(DatabaseError::IncorrectPassphrase) => {}, // Expected
            _ => panic!("Expected IncorrectPassphrase error"),
        }

        // Attempt 2: Correct passphrase → should succeed
        let result2 = open_encrypted_database(dir.path(), correct_passphrase);
        assert!(result2.is_ok());

        // Verify database is functional after retry
        let db = result2.unwrap();
        assert!(db.health_check().is_ok());
    }

    #[test]
    fn test_open_encrypted_database_performance() {
        // Task 9.4: Test database opens in <2 seconds (NFR-1)
        use crate::passphrase;
        use std::time::Instant;

        let dir = tempdir().unwrap();
        let passphrase = "PerformanceTest123!";

        // Setup encrypted database
        let _key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let encryption_key = passphrase::verify_passphrase(passphrase, dir.path()).unwrap();
        let _db = Database::new(db_path, Some(encryption_key)).unwrap();

        // Measure open time
        let start = Instant::now();
        let result = open_encrypted_database(dir.path(), passphrase);
        let duration = start.elapsed();

        assert!(result.is_ok());

        // NFR-1: Should complete in <2 seconds (release build target)
        // Allow up to 5 seconds in debug build (Argon2id is ~10x slower)
        println!("Database open took: {:?} (NFR-1 target: <2s in release)", duration);
        assert!(duration.as_secs() < 5, "Database open took too long: {:?}", duration);
    }

    #[test]
    fn test_open_encrypted_database_query_after_unlock() {
        // Task 9.5: Test database query works after unlock
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase = "QueryTest123!";

        // Setup encrypted database
        let _key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let encryption_key = passphrase::verify_passphrase(passphrase, dir.path()).unwrap();
        let _db = Database::new(db_path, Some(encryption_key)).unwrap();

        // Open encrypted database
        let db = open_encrypted_database(dir.path(), passphrase).unwrap();

        // Query all tables to verify access
        assert_eq!(db.query_proposals_count().unwrap(), 0);
        assert_eq!(db.query_settings_count().unwrap(), 2); // Default settings
        assert_eq!(db.query_job_posts_count().unwrap(), 0);

        // Verify health check
        assert!(db.health_check().is_ok());
    }

    // ====================
    // Story 4a.3 Tests: Job Skills Migration (Task 1)
    // ====================

    #[test]
    fn test_job_skills_table_created() {
        // Task 1.2: Verify V9 migration creates job_skills table
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that job_skills table exists
        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='job_skills'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1);
    }

    #[test]
    fn test_job_skills_table_has_correct_columns() {
        // Task 1.2: Verify job_skills table schema
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get column info
        let mut stmt = conn.prepare("PRAGMA table_info(job_skills)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(columns.contains(&"id".to_string()));
        assert!(columns.contains(&"job_post_id".to_string()));
        assert!(columns.contains(&"skill_name".to_string()));
    }

    #[test]
    fn test_job_skills_foreign_key_constraint() {
        // Task 1.3: Verify foreign key constraint works (should fail with invalid job_post_id)
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Verify foreign keys are enabled
        let fk_enabled: i32 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk_enabled, 1, "Foreign keys should be enabled");

        // Try to insert skill with invalid job_post_id (999999 doesn't exist)
        let result = conn.execute(
            "INSERT INTO job_skills (job_post_id, skill_name) VALUES (?, ?)",
            rusqlite::params![999999, "React"],
        );

        // Should fail due to foreign key constraint
        assert!(result.is_err(), "Insert should fail with invalid foreign key");

        // Verify error is foreign key constraint violation
        let error = result.unwrap_err();
        let error_msg = error.to_string();
        assert!(
            error_msg.contains("foreign key") || error_msg.contains("FOREIGN KEY"),
            "Error should mention foreign key constraint: {}",
            error_msg
        );
    }

    #[test]
    fn test_job_skills_indexes_created() {
        // Task 1.2: Verify indexes exist for performance
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check job_post_id index
        let job_post_id_index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_skills_job_post_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(job_post_id_index_exists, 1);

        // Check skill_name index
        let skill_name_index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_skills_skill_name'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(skill_name_index_exists, 1);
    }
}
