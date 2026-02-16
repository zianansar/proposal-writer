//! Integration tests for passphrase and SQLCipher (Story 2.1, Task 7)

use tempfile::tempdir;
use upwork_research_agent_lib::{db, passphrase};

#[test]
fn test_passphrase_to_sqlcipher_database_open() {
    // Subtask 7.1: Test passphrase → SQLCipher database open → migrations run
    let dir = tempdir().unwrap();
    let passphrase = "MySecurePassphrase123!";

    // Derive encryption key from passphrase
    let key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();

    // Open encrypted database with derived key
    let db_path = dir.path().join("encrypted.db");
    let database = db::Database::new(db_path.clone(), Some(key)).unwrap();

    // Verify database is healthy
    assert!(database.health_check().is_ok());

    // Verify migrations ran (tables should exist)
    let conn = database.conn.lock().unwrap();
    let table_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('proposals', 'settings', 'job_posts')",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(table_count, 3, "All three tables should exist");
}

#[test]
fn test_incorrect_passphrase_fails_database_open() {
    // Subtask 7.2: Test incorrect passphrase fails database open gracefully
    let dir = tempdir().unwrap();
    let correct_passphrase = "MySecurePassphrase123!";
    let wrong_passphrase = "WrongPassphrase456!";

    // Set up encrypted database with correct passphrase
    let correct_key = passphrase::set_passphrase(correct_passphrase, dir.path()).unwrap();
    let db_path = dir.path().join("encrypted.db");
    let _database = db::Database::new(db_path.clone(), Some(correct_key)).unwrap();

    // Drop database to close connection
    drop(_database);

    // Try to open with wrong passphrase
    let wrong_key = passphrase::verify_passphrase(wrong_passphrase, dir.path()).unwrap();
    let result = db::Database::new(db_path, Some(wrong_key));

    // Should fail (SQLCipher will detect wrong key during migration or first query)
    // Note: SQLCipher may not fail immediately on open, but will fail on first operation
    if let Ok(db) = result {
        let health_result = db.health_check();
        assert!(
            health_result.is_err(),
            "Health check should fail with wrong encryption key"
        );
    }
    // If it fails on open, that's also acceptable
}

#[test]
fn test_encrypted_database_data_persistence() {
    // Verify encrypted database can store and retrieve data
    let dir = tempdir().unwrap();
    let passphrase = "MySecurePassphrase123!";

    // Create encrypted database
    let key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();
    let db_path = dir.path().join("encrypted.db");

    {
        let database = db::Database::new(db_path.clone(), Some(key.clone())).unwrap();
        let conn = database.conn.lock().unwrap();

        // Insert test data
        conn.execute(
            "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
            &["Test job", "Test proposal"],
        )
        .unwrap();
    }

    // Reopen database with same key
    {
        let database = db::Database::new(db_path, Some(key)).unwrap();
        let conn = database.conn.lock().unwrap();

        // Retrieve data
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 1);
    }
}

#[test]
fn test_unencrypted_database_still_works() {
    // Subtask 7.3: Verify unencrypted mode still works (Epic 1 compatibility)
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("unencrypted.db");

    // Open database without encryption key
    let database = db::Database::new(db_path, None).unwrap();

    // Should work normally
    assert!(database.health_check().is_ok());

    // Verify tables exist
    let conn = database.conn.lock().unwrap();
    let table_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('proposals', 'settings', 'job_posts')",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(table_count, 3);
}

#[test]
fn test_database_with_invalid_key_length() {
    // Verify database rejects invalid key lengths
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");

    // Try to create database with wrong key length
    let invalid_key = vec![0u8; 16]; // Only 16 bytes, need 32
    let result = db::Database::new(db_path, Some(invalid_key));

    assert!(result.is_err());
    if let Err(err_msg) = result {
        assert!(err_msg.contains("Invalid encryption key length"));
    }
}

#[test]
fn test_passphrase_roundtrip_with_database() {
    // End-to-end test: Set passphrase → Create encrypted DB → Close → Reopen with verification
    let dir = tempdir().unwrap();
    let passphrase = "SecurePassphrase123!";

    // Initial setup
    let key1 = passphrase::set_passphrase(passphrase, dir.path()).unwrap();
    let db_path = dir.path().join("encrypted.db");

    {
        // Create encrypted database
        let database = db::Database::new(db_path.clone(), Some(key1)).unwrap();
        let conn = database.conn.lock().unwrap();

        // Insert test data
        conn.execute(
            "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
            &["Job 1", "Proposal 1"],
        )
        .unwrap();
    }

    // Simulate app restart: verify passphrase and reopen database
    let key2 = passphrase::verify_passphrase(passphrase, dir.path()).unwrap();
    let database = db::Database::new(db_path, Some(key2)).unwrap();
    let conn = database.conn.lock().unwrap();

    // Verify data is accessible
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
        .unwrap();

    assert_eq!(count, 1);
}

// Subtask 7.4: Cross-platform test (Windows 10/11, macOS 12+)
// Note: This test runs on all platforms via CI
#[test]
fn test_cross_platform_salt_storage() {
    let dir = tempdir().unwrap();
    let salt = [123u8; 16];

    // Store and load salt (should work on all platforms)
    let salt_path = passphrase::store_salt(&salt, dir.path()).unwrap();
    assert!(salt_path.exists());

    let loaded_salt = passphrase::load_salt(dir.path()).unwrap();
    assert_eq!(loaded_salt, salt);
}

#[test]
fn test_cross_platform_database_encryption() {
    // Verify SQLCipher works on current platform
    let dir = tempdir().unwrap();
    let passphrase = "CrossPlatformTest123!";

    let key = passphrase::set_passphrase(passphrase, dir.path()).unwrap();
    let db_path = dir.path().join("test.db");

    // This will fail if SQLCipher isn't properly compiled for this platform
    let result = db::Database::new(db_path, Some(key));
    assert!(
        result.is_ok(),
        "SQLCipher should work on this platform: {:?}",
        std::env::consts::OS
    );
}
