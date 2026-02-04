//! Database module for SQLite connection management.
//!
//! Provides thread-safe database access via Mutex<Connection>.
//! For MVP (Epic 1), uses unencrypted SQLite. Epic 2 adds SQLCipher encryption.

pub mod queries;

use refinery::embed_migrations;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

// Embed migrations from the migrations directory
embed_migrations!("src/db/migrations");

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
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        // Open or create the database file
        let mut conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

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
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_database_creation() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path.clone()).unwrap();

        assert!(db_path.exists());
        assert!(db.health_check().is_ok());
    }

    #[test]
    fn test_wal_mode_enabled() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path).unwrap();
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

        let db = Database::new(db_path.clone()).unwrap();

        assert_eq!(db.get_path(), &db_path);
    }

    #[test]
    fn test_migrations_create_proposals_table() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        let db = Database::new(db_path).unwrap();
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

        let db = Database::new(db_path).unwrap();
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

        let db = Database::new(db_path).unwrap();
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

        let db = Database::new(db_path).unwrap();
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

        let db = Database::new(db_path).unwrap();
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

        let db = Database::new(db_path).unwrap();
        let conn = db.conn.lock().unwrap();

        // Check that default settings exist
        let settings_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();

        assert!(settings_count >= 2); // At least theme and api_provider
    }
}
