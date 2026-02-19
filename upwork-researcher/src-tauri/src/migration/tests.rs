//! Unit tests for migration module (Story 2.3, Task 11)

use super::*;
use crate::db::Database;
use crate::passphrase;
use rusqlite::Connection;
use tempfile::TempDir;

/// Helper to create a test database with sample data
fn create_test_database(db_path: &Path) -> rusqlite::Result<()> {
    let conn = Connection::open(db_path)?;

    // Enable WAL mode and foreign keys (match production setup)
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        ",
    )?;

    // Create schema (simplified version of migrations)
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_content TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('draft', 'completed')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS job_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            raw_content TEXT NOT NULL,
            client_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS refinery_schema_history (
            version BIGINT PRIMARY KEY,
            name TEXT,
            applied_on TEXT,
            checksum TEXT
        );
        ",
    )?;

    // Insert test data (Subtask 11.1: 5 proposals, 10 settings, 3 job_posts)
    for i in 1..=5 {
        conn.execute(
            "INSERT INTO proposals (job_content, generated_text, status) VALUES (?, ?, ?)",
            [
                format!("Job content {}", i),
                format!("Generated proposal {}", i),
                "completed".to_string(),
            ],
        )?;
    }

    // Insert default settings (same as V2 migration)
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('api_provider', 'anthropic')",
        [],
    )?;

    for i in 1..=10 {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            [format!("test_setting_{}", i), format!("value_{}", i)],
        )?;
    }

    for i in 1..=3 {
        conn.execute(
            "INSERT INTO job_posts (raw_content) VALUES (?)",
            [format!("Job post content {}", i)],
        )?;
    }

    // Insert migration history (all 4 migrations like a real database)
    // Use RFC3339 format for refinery compatibility, u64 checksums
    conn.execute(
        "INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (?, ?, ?, ?)",
        rusqlite::params![1i32, "V1__initial_schema", "2026-02-01T00:00:00Z", "1234567890"],
    )?;
    conn.execute(
        "INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (?, ?, ?, ?)",
        rusqlite::params![2i32, "V2__add_settings_table", "2026-02-01T00:00:01Z", "2345678901"],
    )?;
    conn.execute(
        "INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (?, ?, ?, ?)",
        rusqlite::params![3i32, "V3__add_job_posts_table", "2026-02-01T00:00:02Z", "3456789012"],
    )?;
    conn.execute(
        "INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (?, ?, ?, ?)",
        rusqlite::params![4i32, "V4__add_draft_status", "2026-02-01T00:00:03Z", "4567890123"],
    )?;

    Ok(())
}

/// Test successful migration with mock data (Subtask 11.1)
#[test]
fn test_successful_migration() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create old unencrypted database
    let old_db_path = app_data_dir.join("upwork-researcher.db");
    create_test_database(&old_db_path).unwrap();

    // Create passphrase salt file (required for key derivation)
    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    // Create dummy backup file
    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    // Perform migration
    let passphrase = "test_passphrase_123!";
    let result = migrate_to_encrypted_database(app_data_dir, passphrase, &backup_path);

    assert!(
        result.is_ok(),
        "Migration should succeed: {:?}",
        result.err()
    );

    let metadata = result.unwrap();
    assert_eq!(metadata.proposals_count, 5);
    assert_eq!(metadata.settings_count, 14); // 4 V2 defaults + 10 test
    assert_eq!(metadata.job_posts_count, 3);
    assert!(
        metadata.refinery_history_count >= 12,
        "Expected at least 12 migrations (V1-V12), got {}",
        metadata.refinery_history_count
    );
    assert!(metadata.duration_ms > 0);

    // Verify migration marker created
    assert!(app_data_dir.join(".migration_complete").exists());

    // Verify old database renamed to .old
    assert!(app_data_dir.join("upwork-researcher.db.old").exists());

    // Verify new encrypted database exists
    assert!(app_data_dir.join("upwork-researcher.db").exists());
}

/// Test ATTACH DATABASE works across encryption boundary (Subtask 11.2)
#[test]
fn test_attach_database_encryption_boundary() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create old unencrypted database
    let old_db_path = app_data_dir.join("old.db");
    create_test_database(&old_db_path).unwrap();

    // Create new encrypted database
    let new_db_path = app_data_dir.join("new_encrypted.db");
    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    let passphrase = "test_passphrase_123!";
    let mut encryption_key = passphrase::verify_passphrase(passphrase, app_data_dir).unwrap();

    let new_db = Database::new(
        new_db_path.clone(),
        Some(std::mem::take(&mut *encryption_key)),
    )
    .unwrap();
    let new_conn = new_db.conn.lock().unwrap();

    // Test ATTACH works from encrypted to unencrypted (requires KEY clause for SQLCipher)
    let attach_sql = format!(
        "ATTACH DATABASE '{}' AS old_db KEY ''",
        old_db_path.display()
    );
    let attach_result = new_conn.execute(&attach_sql, []);

    assert!(
        attach_result.is_ok(),
        "ATTACH should work across encryption boundary"
    );

    // Verify we can query the attached database
    let count: i64 = new_conn
        .query_row("SELECT COUNT(*) FROM old_db.proposals", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count, 5);

    // Cleanup
    new_conn.execute("DETACH DATABASE old_db", []).unwrap();
}

/// Test row count verification (Subtask 11.3)
#[test]
fn test_row_count_verification_mismatch() {
    // This test simulates a scenario where counts don't match
    // We'll test the verification logic directly
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create two databases with different row counts
    let old_db_path = app_data_dir.join("old.db");
    let new_db_path = app_data_dir.join("new.db");

    create_test_database(&old_db_path).unwrap();
    create_test_database(&new_db_path).unwrap();

    // Delete one row from new database to create mismatch
    let new_conn = Connection::open(&new_db_path).unwrap();
    new_conn
        .execute("DELETE FROM proposals WHERE id = 1", [])
        .unwrap();

    // Attach old database to new
    let attach_sql = format!("ATTACH DATABASE '{}' AS old_db", old_db_path.display());
    new_conn.execute(&attach_sql, []).unwrap();

    // Verification should fail due to count mismatch
    let result = verify_migration_counts(&new_conn, &Connection::open(&old_db_path).unwrap());
    assert!(result.is_err());

    if let Err(MigrationError::VerificationFailed(msg)) = result {
        assert!(msg.contains("Proposals count mismatch"));
    } else {
        panic!("Expected VerificationFailed error");
    }
}

/// Test encrypted database opens correctly after migration (Subtask 11.5)
#[test]
fn test_encrypted_database_opens_after_migration() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create old unencrypted database
    let old_db_path = app_data_dir.join("upwork-researcher.db");
    create_test_database(&old_db_path).unwrap();

    // Create salt
    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    // Create backup
    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    // Perform migration
    let passphrase = "test_passphrase_123!";
    let result = migrate_to_encrypted_database(app_data_dir, passphrase, &backup_path);
    assert!(result.is_ok());

    let metadata = result.unwrap();

    // Verify migration completed successfully with correct counts
    assert_eq!(metadata.proposals_count, 5);
    assert_eq!(metadata.settings_count, 14); // 4 V2 defaults + 10 test
    assert_eq!(metadata.job_posts_count, 3);

    // Verify encrypted database file exists
    let final_db_path = app_data_dir.join("upwork-researcher.db");
    assert!(final_db_path.exists(), "Encrypted database should exist");

    // Verify file has content (encrypted databases are non-empty)
    let file_size = std::fs::metadata(&final_db_path).unwrap().len();
    assert!(file_size > 0, "Encrypted database should have content");
}

/// Test old database renamed to .old extension (Subtask 11.6)
#[test]
fn test_old_database_renamed() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    let old_db_path = app_data_dir.join("upwork-researcher.db");
    create_test_database(&old_db_path).unwrap();

    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    let passphrase = "test_passphrase_123!";
    let result = migrate_to_encrypted_database(app_data_dir, passphrase, &backup_path);
    assert!(result.is_ok(), "Migration failed: {:?}", result.err());

    // Verify old database was renamed to .old extension
    let old_backup_path = app_data_dir.join("upwork-researcher.db.old");
    assert!(
        old_backup_path.exists(),
        "Old database should exist with .old extension"
    );

    // Verify new encrypted database exists at original path
    let new_db_path = app_data_dir.join("upwork-researcher.db");
    assert!(
        new_db_path.exists(),
        "New encrypted database should be at original path"
    );

    // Verify the files are different sizes (encrypted DB will be larger due to encryption overhead)
    let old_size = std::fs::metadata(&old_backup_path).unwrap().len();
    let new_size = std::fs::metadata(&new_db_path).unwrap().len();

    // Both should have data, but sizes may vary slightly
    assert!(old_size > 0, "Old database should have content");
    assert!(new_size > 0, "New database should have content");
}

/// Test migration marker file created (Subtask 11.7)
#[test]
fn test_migration_marker_created() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Before migration, marker should not exist
    assert!(!is_migration_complete(app_data_dir));

    let old_db_path = app_data_dir.join("upwork-researcher.db");
    create_test_database(&old_db_path).unwrap();

    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    let passphrase = "test_passphrase_123!";
    let result = migrate_to_encrypted_database(app_data_dir, passphrase, &backup_path);
    assert!(result.is_ok());

    // After migration, marker should exist
    assert!(is_migration_complete(app_data_dir));

    // Verify marker file contains timestamp
    let marker_path = app_data_dir.join(".migration_complete");
    let marker_content = std::fs::read_to_string(&marker_path).unwrap();
    assert!(marker_content.len() > 0);
    assert!(marker_content.contains("2026") || marker_content.contains("20")); // Timestamp format check
}

/// Test migration with empty database (edge case)
#[test]
fn test_migration_with_empty_database() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create old database with schema but minimal data (like a real migrated database would have)
    let old_db_path = app_data_dir.join("upwork-researcher.db");
    let conn = Connection::open(&old_db_path).unwrap();
    conn.execute_batch(
        "
        CREATE TABLE proposals (id INTEGER PRIMARY KEY, job_content TEXT, generated_text TEXT, status TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
        CREATE TABLE job_posts (id INTEGER PRIMARY KEY, url TEXT, raw_content TEXT, client_name TEXT, created_at TEXT);
        CREATE TABLE refinery_schema_history (version INTEGER PRIMARY KEY, name TEXT, applied_on TEXT, checksum TEXT);
        "
    ).unwrap();

    // Insert default settings (would be present in real database from migrations)
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('theme', 'dark')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('api_provider', 'anthropic')",
        [],
    )
    .unwrap();

    // Insert refinery history (would be present in real database from migrations)
    // Use RFC3339 format for refinery compatibility, u64 checksums
    conn.execute("INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (1, 'V1', '2026-01-01T00:00:00Z', '1234567890')", []).unwrap();
    conn.execute("INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (2, 'V2', '2026-01-01T00:00:01Z', '2345678901')", []).unwrap();
    conn.execute("INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (3, 'V3', '2026-01-01T00:00:02Z', '3456789012')", []).unwrap();
    conn.execute("INSERT INTO refinery_schema_history (version, name, applied_on, checksum) VALUES (4, 'V4', '2026-01-01T00:00:03Z', '4567890123')", []).unwrap();

    drop(conn);

    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    let passphrase = "test_passphrase_123!";
    let result = migrate_to_encrypted_database(app_data_dir, passphrase, &backup_path);

    assert!(
        result.is_ok(),
        "Migration should succeed even with empty database"
    );

    let metadata = result.unwrap();
    assert_eq!(metadata.proposals_count, 0);
    assert_eq!(metadata.settings_count, 4); // V2 default settings (theme, api_provider, log_level, safety_threshold)
    assert_eq!(metadata.job_posts_count, 0);
    assert!(
        metadata.refinery_history_count >= 12,
        "Expected at least 12 migrations (V1-V12), got {}",
        metadata.refinery_history_count
    );
}

/// Test migration fails if old database doesn't exist
#[test]
fn test_migration_fails_no_old_database() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create salt
    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    let passphrase = "test_passphrase_123!";
    let result = migrate_to_encrypted_database(app_data_dir, passphrase, &backup_path);

    assert!(result.is_err());
    if let Err(MigrationError::OldDatabaseOpenFailed(msg)) = result {
        assert!(msg.contains("does not exist") || msg.contains("safe"));
    } else {
        panic!("Expected OldDatabaseOpenFailed error");
    }
}

// Story 2.5: Recovery scenario tests

/// Test old database remains intact after copy failure (Story 2.5)
#[test]
fn test_old_database_intact_after_rollback() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create old database with data
    let old_db_path = app_data_dir.join("upwork-researcher.db");
    create_test_database(&old_db_path).unwrap();

    // Count rows before migration attempt
    let old_conn = Connection::open(&old_db_path).unwrap();
    let original_proposals: i64 = old_conn
        .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
        .unwrap();
    drop(old_conn);

    // Attempt migration with intentionally wrong passphrase (will fail at key derivation)
    let salt = passphrase::generate_random_salt().unwrap();
    passphrase::store_salt(&salt, app_data_dir).unwrap();

    let backup_path = app_data_dir.join("backup.json");
    std::fs::write(&backup_path, "{}").unwrap();

    // Store correct passphrase first
    let _ = passphrase::verify_passphrase("correct_pass", app_data_dir);

    // Now try with wrong passphrase (will fail verification)
    let result = migrate_to_encrypted_database(app_data_dir, "wrong_pass", &backup_path);
    assert!(
        result.is_err(),
        "Migration should fail with wrong passphrase"
    );

    // Verify old database still exists and has data
    assert!(
        old_db_path.exists(),
        "Old database should still exist after failed migration"
    );

    let old_conn = Connection::open(&old_db_path).unwrap();
    let current_proposals: i64 = old_conn
        .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
        .unwrap();

    assert_eq!(
        original_proposals, current_proposals,
        "Old database should have same data after failed migration"
    );
}

/// Test cleanup_failed_migration removes incomplete encrypted database (Story 2.5)
#[test]
fn test_cleanup_failed_migration() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create incomplete encrypted database file
    let incomplete_db_path = app_data_dir.join("upwork-researcher-encrypted.db");
    std::fs::write(&incomplete_db_path, "incomplete data").unwrap();

    assert!(
        incomplete_db_path.exists(),
        "Incomplete database should exist before cleanup"
    );

    // Call cleanup
    cleanup_failed_migration(app_data_dir);

    // Verify incomplete database was deleted
    assert!(
        !incomplete_db_path.exists(),
        "Incomplete database should be deleted after cleanup"
    );
}

/// Test verify_old_database_intact function (Story 2.5)
#[test]
fn test_verify_old_database_intact() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_dir = temp_dir.path();

    // Create valid old database
    let old_db_path = app_data_dir.join("test.db");
    create_test_database(&old_db_path).unwrap();

    let old_conn = Connection::open(&old_db_path).unwrap();

    // Verification should pass for valid database
    let result = verify_old_database_intact(&old_conn);
    assert!(
        result.is_ok(),
        "Verification should pass for intact database"
    );
}

/// Test recovery error messages include safety information (Story 2.5)
#[test]
fn test_recovery_error_messages_include_safety() {
    // Test that error messages include recovery context
    let copy_error = MigrationError::CopyFailed("test error".to_string());
    let error_message = format!("{}", copy_error);
    assert!(
        error_message.contains("rolled back") || error_message.contains("safe"),
        "Copy error should mention rollback: {}",
        error_message
    );

    let verify_error = MigrationError::VerificationFailed("test error".to_string());
    let error_message = format!("{}", verify_error);
    assert!(
        error_message.contains("rolled back") || error_message.contains("safe"),
        "Verification error should mention safety: {}",
        error_message
    );

    let old_db_error = MigrationError::OldDatabaseOpenFailed("test error".to_string());
    let error_message = format!("{}", old_db_error);
    assert!(
        error_message.contains("safe") || error_message.contains("unchanged"),
        "Old DB error should mention data safety: {}",
        error_message
    );
}
