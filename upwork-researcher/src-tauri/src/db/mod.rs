//! Database module for SQLite connection management.
//!
//! Provides thread-safe database access via Mutex<Connection>.
//! For MVP (Epic 1), uses unencrypted SQLite. Epic 2 adds SQLCipher encryption.

pub mod queries;

use refinery::embed_migrations;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use zeroize::Zeroizing;

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
        let mut conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        // If encryption key provided, set up SQLCipher (Story 2.1, Epic 2)
        if let Some(key) = encryption_key {
            // TD-3 AC-2: Wrap incoming key bytes in Zeroizing so they're zeroed on drop
            let key = Zeroizing::new(key);

            // Validate key length (32 bytes for AES-256)
            if key.len() != 32 {
                return Err(format!(
                    "Invalid encryption key length: expected 32 bytes, got {}",
                    key.len()
                ));
            }

            // Convert key to hex string for PRAGMA key — wrapped in Zeroizing
            // so the hex string is zeroed from memory after PRAGMA executes (TD-3 AC-2)
            let key_hex = Zeroizing::new(hex::encode(&*key));

            // Set encryption key (must be first operation after open)
            let pragma = Zeroizing::new(format!("PRAGMA key = \"x'{}'\"", &*key_hex));
            conn.execute_batch(&pragma)
                .map_err(|e| format!("Failed to set encryption key: {}", e))?;
            // key, key_hex, and pragma are all zeroed on drop here

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

    /// Re-key the database with a new passphrase-derived encryption key (Story TD-2).
    ///
    /// Derives a new key from the passphrase, executes SQLCipher's `PRAGMA rekey`
    /// to re-encrypt the database in-place, and atomically updates the salt file.
    ///
    /// # Arguments
    /// * `new_passphrase` - New passphrase (must meet strength requirements, 12+ chars)
    /// * `app_data_dir` - App data directory containing .salt file
    ///
    /// # Returns
    /// * `Ok(Zeroizing<Vec<u8>>)` - 32-byte new encryption key in Zeroizing wrapper (caller needs it for recovery key re-wrapping)
    /// * `Err(String)` - Re-key failed; database remains encrypted with old key (AC-4)
    ///
    /// # Safety
    /// - Salt file updated atomically (write temp → rename) per AC-5
    /// - On PRAGMA rekey failure, temp salt is cleaned up, old key remains valid
    pub fn rekey_database(
        &self,
        new_passphrase: &str,
        app_data_dir: &Path,
    ) -> Result<Zeroizing<Vec<u8>>, String> {
        use crate::passphrase;
        use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

        // Backend passphrase strength validation (defense in depth — frontend also validates)
        if new_passphrase.len() < 12 {
            return Err("Passphrase must be at least 12 characters".to_string());
        }

        // Derive new 32-byte key from new passphrase using Argon2id (same params as Story 2-1)
        // TD-3: Key is wrapped in Zeroizing — auto-zeroed on drop
        let new_salt = passphrase::generate_random_salt()
            .map_err(|e| format!("Failed to generate new salt: {}", e))?;
        let mut new_key = passphrase::derive_key(new_passphrase, &new_salt)
            .map_err(|e| format!("Failed to derive new key: {}", e))?;

        // Write new salt to temp file (atomic update pattern — AC-5)
        let salt_path = app_data_dir.join(".salt");
        let salt_tmp_path = app_data_dir.join(".salt.tmp");
        let salt_b64 = BASE64_STANDARD.encode(new_salt);
        std::fs::write(&salt_tmp_path, &salt_b64)
            .map_err(|e| format!("Failed to write temp salt: {}", e))?;

        // Execute PRAGMA rekey on open connection (AC-1)
        // Hex key and PRAGMA string are wrapped in Zeroizing for memory safety (TD-3 AC-2)
        let key_hex = Zeroizing::new(hex::encode(&*new_key));
        {
            let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

            let pragma = Zeroizing::new(format!("PRAGMA rekey = \"x'{}'\"", &*key_hex));
            conn.execute_batch(&pragma).map_err(|e| {
                let _ = std::fs::remove_file(&salt_tmp_path);
                format!("PRAGMA rekey failed: {}", e)
            })?;
            // pragma and key_hex zeroed on drop

            // Verify database accessible with new key after rekey
            conn.execute_batch("SELECT count(*) FROM sqlite_master;")
                .map_err(|e| {
                    let _ = std::fs::remove_file(&salt_tmp_path);
                    format!("Database verification failed after rekey: {}", e)
                })?;
        }

        // Rekey succeeded — atomically update salt file (AC-5)
        std::fs::rename(&salt_tmp_path, &salt_path)
            .map_err(|e| format!("Failed to update salt file: {}", e))?;

        tracing::info!("Database re-keyed successfully with new passphrase");

        // Return key in Zeroizing wrapper — caller's copy is auto-zeroed on drop (TD-3 review fix #2)
        Ok(new_key)
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

/// Wrapper for database state supporting lazy initialization (Story 2.7b).
///
/// For unencrypted databases: initialized immediately during app setup.
/// For encrypted databases: initialized after passphrase entry.
///
/// Uses `OnceLock` for zero-cost reads after initialization — no locking
/// overhead on the hot path (database access in commands).
pub struct AppDatabase {
    inner: std::sync::OnceLock<Database>,
}

impl AppDatabase {
    /// Create empty AppDatabase (encrypted startup path — waiting for passphrase).
    pub fn new_empty() -> Self {
        Self {
            inner: std::sync::OnceLock::new(),
        }
    }

    /// Create pre-initialized AppDatabase (unencrypted startup path).
    pub fn new_with(db: Database) -> Self {
        let app_db = Self::new_empty();
        // Safe: called only once during setup before any commands run
        let _ = app_db.inner.set(db);
        app_db
    }

    /// Get database reference. Returns error if not yet unlocked.
    pub fn get(&self) -> Result<&Database, String> {
        self.inner
            .get()
            .ok_or_else(|| "Database not unlocked - passphrase required".to_string())
    }

    /// Set database after successful passphrase verification.
    /// Can only be called once — subsequent calls return error.
    pub fn set(&self, db: Database) -> Result<(), String> {
        self.inner
            .set(db)
            .map_err(|_| "Database already initialized".to_string())
    }

    /// Check if database is ready for use.
    pub fn is_ready(&self) -> bool {
        self.inner.get().is_some()
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
pub fn open_encrypted_database(
    app_data_dir: &Path,
    passphrase: &str,
) -> Result<Database, DatabaseError> {
    use crate::passphrase;

    // Subtask 2.2: Call verify_passphrase_and_derive_key() to get encryption key
    // Key is wrapped in Zeroizing — raw bytes are zeroed when this binding drops (TD-3 AC-2)
    let mut encryption_key = passphrase::verify_passphrase_and_derive_key(passphrase, app_data_dir)
        .map_err(|e| DatabaseError::PassphraseError(e.to_string()))?;

    // Subtask 2.3: Call Database::new() with derived key
    // std::mem::take moves bytes out; Zeroizing wrapper zeros the (now-empty) vec on drop.
    // Database::new() re-wraps in Zeroizing internally for hex zeroing (TD-3 AC-2).
    let db_path = app_data_dir.join("upwork-researcher.db");
    let db = Database::new(db_path, Some(std::mem::take(&mut *encryption_key))).map_err(|e| {
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
            .query_row("SELECT COUNT(*) FROM refinery_schema_history", [], |row| {
                row.get(0)
            })
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
            assert!(
                error_msg.contains("Failed to open database")
                    || error_msg.contains("unable to open")
            );
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
        let _db = Database::new(db_path, Some(encryption_key.to_vec())).unwrap();

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
        let _db = Database::new(db_path, Some(encryption_key.to_vec())).unwrap();

        // Story 2.7: Try to open with wrong passphrase
        let result = open_encrypted_database(dir.path(), wrong_passphrase);

        assert!(result.is_err());
        match result {
            Err(DatabaseError::IncorrectPassphrase) => {} // Expected
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
            Err(DatabaseError::PassphraseError(_)) => {} // Expected
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
        let _db = Database::new(db_path, Some(encryption_key.to_vec())).unwrap();

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
        let _db = Database::new(db_path, Some(encryption_key.to_vec())).unwrap();

        // Attempt 1: Wrong passphrase → should fail
        let result1 = open_encrypted_database(dir.path(), wrong_passphrase);
        assert!(result1.is_err());
        match result1 {
            Err(DatabaseError::IncorrectPassphrase) => {} // Expected
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
        let _db = Database::new(db_path, Some(encryption_key.to_vec())).unwrap();

        // Measure open time
        let start = Instant::now();
        let result = open_encrypted_database(dir.path(), passphrase);
        let duration = start.elapsed();

        assert!(result.is_ok());

        // NFR-1: Should complete in <2 seconds (release build target)
        // Allow up to 5 seconds in debug build (Argon2id is ~10x slower)
        println!(
            "Database open took: {:?} (NFR-1 target: <2s in release)",
            duration
        );
        assert!(
            duration.as_secs() < 5,
            "Database open took too long: {:?}",
            duration
        );
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
        let _db = Database::new(db_path, Some(encryption_key.to_vec())).unwrap();

        // Open encrypted database
        let db = open_encrypted_database(dir.path(), passphrase).unwrap();

        // Query all tables to verify access
        assert_eq!(db.query_proposals_count().unwrap(), 0);
        assert_eq!(db.query_settings_count().unwrap(), 4); // V2 default settings
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
        assert!(
            result.is_err(),
            "Insert should fail with invalid foreign key"
        );

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

    // ====================
    // Story 4b.2 Tests: Job Scores Migration (V12)
    // ====================

    #[test]
    fn test_job_scores_table_created() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='job_scores'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1);
    }

    #[test]
    fn test_job_scores_table_has_correct_columns() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let mut stmt = conn.prepare("PRAGMA table_info(job_scores)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(columns.contains(&"id".to_string()));
        assert!(columns.contains(&"job_post_id".to_string()));
        assert!(columns.contains(&"skills_match_percentage".to_string()));
        assert!(columns.contains(&"client_quality_score".to_string()));
        assert!(columns.contains(&"budget_alignment_score".to_string()));
        assert!(columns.contains(&"overall_score".to_string()));
        assert!(columns.contains(&"calculated_at".to_string()));
    }

    #[test]
    fn test_job_scores_indexes_created() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let job_post_id_index: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_scores_job_post_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(job_post_id_index, 1);

        let overall_index: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_scores_overall'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(overall_index, 1);
    }

    #[test]
    fn test_job_scores_foreign_key_constraint() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let fk_enabled: i32 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk_enabled, 1);

        let result = conn.execute(
            "INSERT INTO job_scores (job_post_id, skills_match_percentage) VALUES (?, ?)",
            rusqlite::params![999999, 75.0],
        );

        assert!(
            result.is_err(),
            "Insert should fail with invalid foreign key"
        );
    }

    #[test]
    fn test_job_scores_unique_job_post_id() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Insert a job post first
        conn.execute(
            "INSERT INTO job_posts (raw_content) VALUES (?)",
            rusqlite::params!["Test job"],
        )
        .unwrap();
        let job_id: i64 = conn.last_insert_rowid();

        // First insert should succeed
        conn.execute(
            "INSERT INTO job_scores (job_post_id, skills_match_percentage) VALUES (?, ?)",
            rusqlite::params![job_id, 75.0],
        )
        .unwrap();

        // Second insert with same job_post_id should fail (UNIQUE constraint)
        let result = conn.execute(
            "INSERT INTO job_scores (job_post_id, skills_match_percentage) VALUES (?, ?)",
            rusqlite::params![job_id, 80.0],
        );
        assert!(
            result.is_err(),
            "Should fail with UNIQUE constraint violation"
        );
    }

    // ====================
    // Story 4b.9 Tests: Job Queue Indexes (V17)
    // ====================

    #[test]
    fn test_job_queue_overall_score_index_exists() {
        // Task 1.2: Verify overall_score index exists
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_posts_overall_score'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_exists, 1, "overall_score index should exist");
    }

    #[test]
    fn test_job_queue_created_at_index_exists() {
        // Task 1.3: Verify created_at index exists
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Note: This index already existed from V3 migration, V17 adds it with IF NOT EXISTS
        let index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_posts_created_at'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_exists, 1, "created_at index should exist");
    }

    #[test]
    fn test_job_queue_client_name_index_exists() {
        // Task 1.4: Verify client_name index exists
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let index_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_job_posts_client_name'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_exists, 1, "client_name index should exist");
    }

    #[test]
    fn test_job_queue_indexes_used_in_queries() {
        // Task 1.5: Verify EXPLAIN QUERY PLAN shows indexes are used
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Insert test job posts with scores
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score) VALUES (?, ?, ?)",
            rusqlite::params!["Job 1", "Client A", 85.5],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score) VALUES (?, ?, ?)",
            rusqlite::params!["Job 2", "Client B", 92.0],
        )
        .unwrap();

        // Test 1: Overall score sort uses index
        let mut stmt = conn
            .prepare("EXPLAIN QUERY PLAN SELECT id, overall_score FROM job_posts ORDER BY overall_score DESC")
            .unwrap();
        let plan: String = stmt
            .query_map([], |row| row.get::<_, String>(3))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>()
            .join(" ");

        assert!(
            plan.to_lowercase().contains("idx_job_posts_overall_score")
                || plan.to_lowercase().contains("index"),
            "Query plan should use overall_score index: {}",
            plan
        );

        // Test 2: Created_at sort uses index
        let mut stmt = conn
            .prepare(
                "EXPLAIN QUERY PLAN SELECT id, created_at FROM job_posts ORDER BY created_at DESC",
            )
            .unwrap();
        let plan: String = stmt
            .query_map([], |row| row.get::<_, String>(3))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>()
            .join(" ");

        assert!(
            plan.to_lowercase().contains("idx_job_posts_created_at")
                || plan.to_lowercase().contains("index"),
            "Query plan should use created_at index: {}",
            plan
        );

        // Test 3: Client name sort uses index
        let mut stmt = conn
            .prepare(
                "EXPLAIN QUERY PLAN SELECT id, client_name FROM job_posts ORDER BY client_name ASC",
            )
            .unwrap();
        let plan: String = stmt
            .query_map([], |row| row.get::<_, String>(3))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect::<Vec<_>>()
            .join(" ");

        assert!(
            plan.to_lowercase().contains("idx_job_posts_client_name")
                || plan.to_lowercase().contains("index"),
            "Query plan should use client_name index: {}",
            plan
        );
    }

    // Story 5.1: Hook Strategies Seed Data Tests

    // ====================
    // Story TD-2 Tests: Database Re-key with PRAGMA rekey
    // ====================

    #[test]
    fn test_rekey_database_success() {
        // TD-2 AC-1: PRAGMA rekey re-encrypts database, data remains accessible
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        // Setup: create encrypted DB with passphrase A
        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Insert test data before rekey
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
                ["Test job", "Test proposal"],
            )
            .unwrap();
        }

        // Rekey with passphrase B
        let new_key = db.rekey_database(passphrase_b, dir.path()).unwrap();
        assert_eq!(new_key.len(), 32, "New key should be 32 bytes");

        // Verify data still accessible after rekey
        assert_eq!(db.query_proposals_count().unwrap(), 1);
        assert!(db.health_check().is_ok());
    }

    #[test]
    fn test_rekey_database_reopens_with_new_passphrase() {
        // TD-2 AC-2: Database opens with new passphrase after restart
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        // Setup encrypted DB
        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Rekey
        let _new_key = db.rekey_database(passphrase_b, dir.path()).unwrap();
        drop(db);

        // Reopen with new passphrase (simulates app restart)
        let result = open_encrypted_database(dir.path(), passphrase_b);
        assert!(
            result.is_ok(),
            "Should open with new passphrase after rekey"
        );
        result.unwrap().health_check().unwrap();
    }

    #[test]
    fn test_rekey_database_old_passphrase_fails() {
        // TD-2: Old passphrase no longer works after rekey
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        // Setup encrypted DB with passphrase A
        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Rekey with passphrase B
        db.rekey_database(passphrase_b, dir.path()).unwrap();
        drop(db);

        // Old passphrase should fail (salt file now has new salt)
        let result = open_encrypted_database(dir.path(), passphrase_a);
        assert!(result.is_err(), "Old passphrase should fail after rekey");
    }

    #[test]
    fn test_rekey_database_salt_updated() {
        // TD-2 AC-5: Salt file updated with new passphrase's salt
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        // Setup
        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Read old salt
        let old_salt = std::fs::read_to_string(dir.path().join(".salt")).unwrap();

        // Rekey
        db.rekey_database(passphrase_b, dir.path()).unwrap();

        // Read new salt — should differ
        let new_salt = std::fs::read_to_string(dir.path().join(".salt")).unwrap();
        assert_ne!(old_salt, new_salt, "Salt should change after rekey");
    }

    #[test]
    fn test_rekey_database_preserves_data() {
        // TD-2: All existing data survives re-key
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Insert multiple records
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
                ["Job 1", "Proposal 1"],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
                ["Job 2", "Proposal 2"],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO job_posts (raw_content) VALUES (?)",
                ["Raw job post"],
            )
            .unwrap();
        }

        // Rekey
        db.rekey_database(passphrase_b, dir.path()).unwrap();
        drop(db);

        // Reopen with new passphrase and verify all data
        let db2 = open_encrypted_database(dir.path(), passphrase_b).unwrap();
        assert_eq!(db2.query_proposals_count().unwrap(), 2);
        assert_eq!(db2.query_job_posts_count().unwrap(), 1);
    }

    #[test]
    fn test_rekey_database_recovery_key_roundtrip() {
        // TD-2 AC-3/Task 4: Recovery key still works after re-encryption
        use crate::keychain::recovery;
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        // Setup encrypted DB
        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Generate recovery key and wrap the original DB key
        let recovery_key = recovery::generate_recovery_key().unwrap();
        let wrapped_key = recovery::wrap_db_key(&key_a, &recovery_key).unwrap();

        // Rekey the database
        let new_db_key = db.rekey_database(passphrase_b, dir.path()).unwrap();
        drop(db);

        // Re-wrap with new key (as set_new_passphrase_after_recovery does)
        let new_wrapped_key = recovery::wrap_db_key(&new_db_key, &recovery_key).unwrap();

        // Unwrap with recovery key should return new DB key
        let unwrapped_key = recovery::unwrap_db_key(&new_wrapped_key, &recovery_key).unwrap();
        assert_eq!(
            unwrapped_key, *new_db_key,
            "Unwrapped key should match new DB key"
        );

        // Open DB with unwrapped key should work
        let db_path = dir.path().join("upwork-researcher.db");
        let db2 = Database::new(db_path, Some(unwrapped_key)).unwrap();
        assert!(db2.health_check().is_ok());

        // Old wrapped key should NOT work (wrong DB key)
        let old_unwrapped = recovery::unwrap_db_key(&wrapped_key, &recovery_key).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let result = Database::new(db_path, Some(old_unwrapped));
        assert!(
            result.is_err(),
            "Old wrapped key should not open re-keyed database"
        );
    }

    #[test]
    fn test_rekey_database_no_temp_salt_on_success() {
        // TD-2 AC-5: Temp salt file cleaned up after successful rekey
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        db.rekey_database(passphrase_b, dir.path()).unwrap();

        // .salt.tmp should not exist after successful rekey (renamed to .salt)
        assert!(
            !dir.path().join(".salt.tmp").exists(),
            "Temp salt file should be cleaned up"
        );
        assert!(dir.path().join(".salt").exists(), "Salt file should exist");
    }

    #[test]
    fn test_rekey_database_failure_preserves_original() {
        // TD-2 AC-4: Failed rekey leaves database accessible with original key
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";
        let passphrase_b = "NewSecurePass456!";

        // Setup encrypted DB with passphrase A
        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Insert test data
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
                ["Test job", "Test proposal"],
            )
            .unwrap();
        }

        // Read original salt
        let original_salt = std::fs::read_to_string(dir.path().join(".salt")).unwrap();

        // Attempt rekey with non-existent app_data_dir (forces temp salt write failure — before PRAGMA rekey)
        let bad_dir = dir.path().join("nonexistent_subdir");
        let result = db.rekey_database(passphrase_b, &bad_dir);
        assert!(
            result.is_err(),
            "Rekey should fail with invalid app_data_dir"
        );

        // Verify database still accessible with original data (AC-4)
        assert_eq!(db.query_proposals_count().unwrap(), 1);
        assert!(db.health_check().is_ok());

        // Verify salt file unchanged
        let current_salt = std::fs::read_to_string(dir.path().join(".salt")).unwrap();
        assert_eq!(
            original_salt, current_salt,
            "Salt should be unchanged after failed rekey"
        );

        // Verify no temp salt file left behind
        assert!(
            !dir.path().join(".salt.tmp").exists(),
            "No temp salt should exist after failure"
        );
    }

    #[test]
    fn test_rekey_database_rejects_short_passphrase() {
        // TD-2 Fix 4: Backend passphrase strength validation
        use crate::passphrase;

        let dir = tempdir().unwrap();
        let passphrase_a = "OriginalPass123!";

        let key_a = passphrase::set_passphrase(passphrase_a, dir.path()).unwrap();
        let db_path = dir.path().join("upwork-researcher.db");
        let db = Database::new(db_path, Some(key_a.to_vec())).unwrap();

        // Attempt rekey with short passphrase (< 12 chars)
        let result = db.rekey_database("short", dir.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("at least 12 characters"));

        // DB should be unchanged
        assert!(db.health_check().is_ok());
    }

    #[test]
    fn test_hook_strategies_table_created() {
        // AC-1: Verify hook_strategies table is created after migrations run
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='hook_strategies'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1, "hook_strategies table should exist");
    }

    #[test]
    fn test_hook_strategies_table_has_correct_columns() {
        // AC-1: Verify hook_strategies table has all required columns
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get column info using PRAGMA table_info
        let mut stmt = conn.prepare("PRAGMA table_info(hook_strategies)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        // AC-1: Verify required columns exist
        assert!(
            columns.contains(&"id".to_string()),
            "id column should exist"
        );
        assert!(
            columns.contains(&"name".to_string()),
            "name column should exist"
        );
        assert!(
            columns.contains(&"description".to_string()),
            "description column should exist"
        );
        assert!(
            columns.contains(&"examples_json".to_string()),
            "examples_json column should exist"
        );
        assert!(
            columns.contains(&"best_for".to_string()),
            "best_for column should exist"
        );
        assert!(
            columns.contains(&"created_at".to_string()),
            "created_at column should exist"
        );
    }

    #[test]
    fn test_hook_strategies_seeded_with_defaults() {
        // AC-2: Verify 5 default hook strategies are seeded
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Count total strategies
        let strategies_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM hook_strategies", [], |row| row.get(0))
            .unwrap();

        assert_eq!(
            strategies_count, 5,
            "Should have exactly 5 default hook strategies"
        );

        // AC-2: Verify each expected strategy exists
        let expected_strategies = vec![
            "Social Proof",
            "Contrarian",
            "Immediate Value",
            "Problem-Aware",
            "Question-Based",
        ];

        for strategy_name in expected_strategies {
            let exists: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM hook_strategies WHERE name = ?",
                    [strategy_name],
                    |row| row.get(0),
                )
                .unwrap();

            assert_eq!(exists, 1, "Strategy '{}' should exist", strategy_name);
        }
    }

    #[test]
    fn test_hook_strategies_have_valid_json_examples() {
        // AC-3: Verify each strategy has valid JSON examples with 2-3 elements
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get all strategies
        let mut stmt = conn
            .prepare("SELECT name, examples_json FROM hook_strategies")
            .unwrap();

        let strategies: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(strategies.len(), 5, "Should have 5 strategies");

        // Verify each strategy has valid JSON with 2-3 examples
        for (name, examples_json) in strategies {
            // Parse JSON
            let examples: serde_json::Value = serde_json::from_str(&examples_json)
                .unwrap_or_else(|_| panic!("Strategy '{}' should have valid JSON", name));

            // Verify it's an array
            assert!(
                examples.is_array(),
                "Strategy '{}' examples should be a JSON array",
                name
            );

            let examples_array = examples.as_array().unwrap();

            // AC-3: Verify 2-3 examples per strategy
            assert!(
                examples_array.len() >= 2 && examples_array.len() <= 3,
                "Strategy '{}' should have 2-3 examples, got {}",
                name,
                examples_array.len()
            );

            // Verify each example is a non-empty string
            for (idx, example) in examples_array.iter().enumerate() {
                assert!(
                    example.is_string() && !example.as_str().unwrap().is_empty(),
                    "Strategy '{}' example {} should be a non-empty string",
                    name,
                    idx
                );
            }
        }
    }

    // ====================
    // Story 10.2 Tests: Remote Config Storage (V3 migration)
    // ====================

    #[test]
    fn test_remote_config_table_created() {
        // Task 1.4: Verify V3 migration creates remote_config table
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that remote_config table exists
        let table_exists: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='remote_config'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_exists, 1, "remote_config table should exist");
    }

    #[test]
    fn test_remote_config_table_has_correct_columns() {
        // Task 1.4 / AC-1: Verify remote_config table has all required columns
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Get column info
        let mut stmt = conn.prepare("PRAGMA table_info(remote_config)").unwrap();
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        // AC-1: Verify all required columns exist
        assert!(columns.contains(&"id".to_string()), "id column should exist");
        assert!(
            columns.contains(&"schema_version".to_string()),
            "schema_version column should exist"
        );
        assert!(
            columns.contains(&"config_json".to_string()),
            "config_json column should exist"
        );
        assert!(
            columns.contains(&"fetched_at".to_string()),
            "fetched_at column should exist"
        );
        assert!(
            columns.contains(&"signature".to_string()),
            "signature column should exist"
        );
        assert!(
            columns.contains(&"source".to_string()),
            "source column should exist"
        );
    }

    #[test]
    fn test_remote_config_table_default_source() {
        // AC-1: Verify source column has DEFAULT 'remote'
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        // Insert row without specifying source
        conn.execute(
            "INSERT INTO remote_config (id, schema_version, config_json, fetched_at, signature) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![1, "1.0.0", "{}", "2026-02-17T00:00:00Z", "test_sig"],
        )
        .unwrap();

        // Query source value
        let source: String = conn
            .query_row(
                "SELECT source FROM remote_config WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(source, "remote", "Default source should be 'remote'");
    }
}
