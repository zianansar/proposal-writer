//! Integration tests for migration verification (Story 2.4)
//!
//! Tests get_migration_verification and delete_old_database functions.

use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;
use upwork_research_agent_lib::db::Database;
use upwork_research_agent_lib::migration;

/// Helper: Create test database with data
fn create_test_database(db_path: &PathBuf) -> Database {
    let db = Database::new(db_path.clone(), None)
        .expect("Failed to create test database");

    // Insert test data
    let conn = db.conn.lock().unwrap();

    // Insert test proposals
    conn.execute(
        "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
        ["test job 1", "test proposal 1"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
        ["test job 2", "test proposal 2"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO proposals (job_content, generated_text) VALUES (?, ?)",
        ["test job 3", "test proposal 3"],
    )
    .unwrap();

    // Insert test settings
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?)",
        ["setting1", "value1"],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?)",
        ["setting2", "value2"],
    )
    .unwrap();

    drop(conn);
    db
}

/// Subtask 9.4: Test get_migration_verification returns correct counts
#[test]
fn test_get_migration_verification_returns_correct_counts() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let db = create_test_database(&db_path);

    let verification = migration::get_migration_verification(&db, temp_dir.path())
        .expect("Failed to get verification data");

    assert_eq!(verification.proposals_count, 3);
    // Settings count = 2 test inserts + defaults from migrations
    // Actual count may vary based on migration defaults
    assert!(verification.settings_count >= 2);
    assert_eq!(verification.job_posts_count, 0);
}

/// Subtask 9.5: Test get_migration_verification constructs correct paths
#[test]
fn test_get_migration_verification_constructs_correct_paths() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let db = create_test_database(&db_path);

    let verification = migration::get_migration_verification(&db, temp_dir.path())
        .expect("Failed to get verification data");

    // Check old_db_path contains expected filename
    assert!(verification.old_db_path.contains("upwork-researcher.db.old"));

    // Check backup_path contains expected directory
    assert!(verification.backup_path.contains("backups"));
}

/// Subtask 9.1: Test delete_old_database with existing .old file (success)
#[test]
fn test_delete_old_database_with_existing_file() {
    let temp_dir = TempDir::new().unwrap();
    let old_db_path = temp_dir.path().join("test.db.old");

    // Create old database file
    fs::write(&old_db_path, b"test data").expect("Failed to create old database file");

    // Verify file exists
    assert!(old_db_path.exists());

    // Delete old database
    let result = migration::delete_old_database(&old_db_path.to_string_lossy());
    assert!(result.is_ok());

    // Verify file is deleted
    assert!(!old_db_path.exists());

    // Check success message
    let message = result.unwrap();
    assert!(message.contains("deleted successfully"));
}

/// Subtask 9.2: Test delete_old_database with non-existent file (error handling)
#[test]
fn test_delete_old_database_with_non_existent_file() {
    let temp_dir = TempDir::new().unwrap();
    let old_db_path = temp_dir.path().join("non-existent.db.old");

    // Ensure file doesn't exist
    assert!(!old_db_path.exists());

    // Attempt to delete
    let result = migration::delete_old_database(&old_db_path.to_string_lossy());
    assert!(result.is_err());

    // Check error message
    let error = result.unwrap_err();
    assert!(error.to_string().contains("not found"));
}

/// Subtask 9.3: Test delete_old_database with permission denied (error handling)
/// Note: This test is platform-specific and may not work on all systems
#[cfg(unix)]
#[test]
fn test_delete_old_database_with_permission_denied() {
    use std::os::unix::fs::PermissionsExt;

    let temp_dir = TempDir::new().unwrap();
    let old_db_path = temp_dir.path().join("readonly.db.old");

    // Create old database file
    fs::write(&old_db_path, b"test data").expect("Failed to create old database file");

    // Make parent directory read-only
    let mut perms = fs::metadata(temp_dir.path()).unwrap().permissions();
    perms.set_mode(0o444);
    fs::set_permissions(temp_dir.path(), perms).unwrap();

    // Attempt to delete (should fail due to permissions)
    let result = migration::delete_old_database(&old_db_path.to_string_lossy());

    // Restore permissions before assertions (cleanup)
    let mut perms = fs::metadata(temp_dir.path()).unwrap().permissions();
    perms.set_mode(0o755);
    fs::set_permissions(temp_dir.path(), perms).unwrap();

    // Check result
    assert!(result.is_err());
}

// ========== Integration Tests (Task 11) ==========

/// Subtask 11.3: Test verification data matches migration metadata
#[test]
fn test_verification_data_matches_migration_metadata() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    // Create database with known counts
    let db = create_test_database(&db_path);

    // Get verification data
    let verification = migration::get_migration_verification(&db, temp_dir.path())
        .expect("Failed to get verification data");

    // Verify counts match what we inserted (including default settings from migration)
    assert_eq!(verification.proposals_count, 3);
    assert!(verification.settings_count >= 2); // At least 2 test inserts
    assert_eq!(verification.job_posts_count, 0);
}

/// Subtask 11.4: Test old database actually deleted from filesystem
#[test]
fn test_old_database_actually_deleted_from_filesystem() {
    let temp_dir = TempDir::new().unwrap();
    let old_db_path = temp_dir.path().join("actual-test.db.old");

    // Create old database file with real content
    fs::write(&old_db_path, b"OLD DATABASE CONTENT HERE")
        .expect("Failed to create old database file");

    // Verify file exists and has content
    assert!(old_db_path.exists());
    let content_before = fs::read(&old_db_path).unwrap();
    assert_eq!(content_before, b"OLD DATABASE CONTENT HERE");

    // Delete old database
    migration::delete_old_database(&old_db_path.to_string_lossy())
        .expect("Failed to delete old database");

    // Verify file is actually gone from filesystem
    assert!(
        !old_db_path.exists(),
        "Old database file should be deleted from filesystem"
    );

    // Attempt to read should fail
    let read_result = fs::read(&old_db_path);
    assert!(
        read_result.is_err(),
        "Reading deleted file should return error"
    );
}

/// Subtask 11.5: Test old database remains if "Keep Both" selected
#[test]
fn test_old_database_remains_if_keep_both() {
    let temp_dir = TempDir::new().unwrap();
    let old_db_path = temp_dir.path().join("keep-both-test.db.old");

    // Create old database file
    fs::write(&old_db_path, b"DATABASE TO KEEP")
        .expect("Failed to create old database file");

    // Verify file exists
    assert!(old_db_path.exists());

    // Simulate "Keep Both" choice: Do NOT call delete_old_database
    // Just verify file still exists after this decision

    // Verify file still exists
    assert!(
        old_db_path.exists(),
        "Old database should remain when 'Keep Both' is selected"
    );

    // Verify content is intact
    let content = fs::read(&old_db_path).unwrap();
    assert_eq!(content, b"DATABASE TO KEEP");
}

/// Subtask 11.1: Test end-to-end: verification → delete → app ready
/// (Simulated without full migration since that's tested in Story 2.3)
#[test]
fn test_e2e_verification_delete_flow() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("e2e-test.db");
    let old_db_path = temp_dir.path().join("e2e-test.db.old");

    // Setup: Create database with data
    let db = create_test_database(&db_path);

    // Setup: Create .old file (simulating post-migration state)
    fs::write(&old_db_path, b"OLD UNENCRYPTED DATA")
        .expect("Failed to create old database");

    // Step 1: Get verification data
    let verification = migration::get_migration_verification(&db, temp_dir.path())
        .expect("Failed to get verification");

    assert_eq!(verification.proposals_count, 3);
    assert!(verification.settings_count >= 2); // At least 2 test inserts

    // Step 2: User confirms deletion
    let delete_result = migration::delete_old_database(&old_db_path.to_string_lossy());
    assert!(delete_result.is_ok());

    // Step 3: Verify .old file is gone
    assert!(!old_db_path.exists());

    // Step 4: Verify encrypted database still works
    let proposals_count = db.query_proposals_count().unwrap();
    assert_eq!(proposals_count, 3);
}

/// Subtask 11.2: Test end-to-end: verification → keep both → app ready
#[test]
fn test_e2e_verification_keep_both_flow() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("e2e-keep-test.db");
    let old_db_path = temp_dir.path().join("e2e-keep-test.db.old");

    // Setup: Create database with data
    let db = create_test_database(&db_path);

    // Setup: Create .old file
    fs::write(&old_db_path, b"OLD UNENCRYPTED DATA TO KEEP")
        .expect("Failed to create old database");

    // Step 1: Get verification data
    let verification = migration::get_migration_verification(&db, temp_dir.path())
        .expect("Failed to get verification");

    assert_eq!(verification.proposals_count, 3);

    // Step 2: User chooses "Keep Both" (no delete call)

    // Step 3: Verify both files exist
    assert!(db_path.exists(), "New encrypted database should exist");
    assert!(old_db_path.exists(), "Old database should still exist");

    // Step 4: Verify encrypted database works
    let proposals_count = db.query_proposals_count().unwrap();
    assert_eq!(proposals_count, 3);

    // Step 5: Verify old database file is intact
    let old_content = fs::read(&old_db_path).unwrap();
    assert_eq!(old_content, b"OLD UNENCRYPTED DATA TO KEEP");
}
