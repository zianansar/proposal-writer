//! Migration tests for voice_profiles table (Story 5-5b, Task 5, Subtask 5.1)
//!
//! Tests verify V21 migration creates table with proper schema, constraints, and triggers

use rusqlite::Connection;
use tempfile::TempDir;
use upwork_research_agent_lib::db::Database;

/// Test V21 migration creates voice_profiles table with correct schema
#[test]
fn test_migration_creates_voice_profiles_table() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    // Create database (runs all migrations including V21)
    let _db = Database::new(db_path.clone(), None)
        .expect("Failed to create database with migrations");

    // Open connection to verify schema
    let conn = Connection::open(&db_path).unwrap();

    // Verify table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='voice_profiles'",
            [],
            |row| row.get::<_, i64>(0).map(|count| count == 1),
        )
        .unwrap();

    assert!(table_exists, "voice_profiles table should be created by migration");
}

/// Test voice_profiles table has all required columns
#[test]
fn test_voice_profiles_has_all_columns() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Query table schema
    let mut stmt = conn
        .prepare("PRAGMA table_info(voice_profiles)")
        .unwrap();

    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    // Verify all required columns exist
    let required_columns = vec![
        "id",
        "user_id",
        "tone_score",
        "technical_depth",
        "avg_sentence_length",
        "vocabulary_complexity",
        "structure_paragraphs_pct",
        "structure_bullets_pct",
        "common_phrases",
        "sample_count",
        "calibration_source",
        "created_at",
        "updated_at",
    ];

    for col in required_columns {
        assert!(
            columns.contains(&col.to_string()),
            "Column '{}' should exist in voice_profiles table",
            col
        );
    }
}

/// Test CHECK constraint rejects tone_score outside 1-10 range
#[test]
fn test_tone_score_check_constraint() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Valid value (should succeed)
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (5.5, 7.0, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(result.is_ok(), "Valid tone_score should be accepted");

    // Invalid value below range (should fail)
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (0.5, 7.0, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(result.is_err(), "tone_score < 1 should be rejected");

    // Invalid value above range (should fail)
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (10.5, 7.0, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(result.is_err(), "tone_score > 10 should be rejected");
}

/// Test CHECK constraint rejects technical_depth outside 1-10 range
#[test]
fn test_technical_depth_check_constraint() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Invalid value below range
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (5.0, 0.5, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(result.is_err(), "technical_depth < 1 should be rejected");

    // Invalid value above range
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (5.0, 11.0, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(result.is_err(), "technical_depth > 10 should be rejected");
}

/// Test CHECK constraint rejects percentages outside 0-100 range
#[test]
fn test_percentage_check_constraints() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Invalid structure_paragraphs_pct above range
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (5.0, 7.0, 15.0, 12.0, 101, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(
        result.is_err(),
        "structure_paragraphs_pct > 100 should be rejected"
    );

    // Invalid structure_bullets_pct below range
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (5.0, 7.0, 15.0, 12.0, 60, -1, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(
        result.is_err(),
        "structure_bullets_pct < 0 should be rejected"
    );
}

/// Test CHECK constraint rejects invalid calibration_source enum values
#[test]
fn test_calibration_source_enum_constraint() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Valid enum values should succeed
    for source in &["GoldenSet", "QuickCalibration", "Implicit"] {
        let result = conn.execute(
            "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
                structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source, user_id)
             VALUES (5.0, 7.0, 15.0, 12.0, 60, 40, '[]', 10, ?1, ?2)",
            rusqlite::params![source, format!("user_{}", source)],
        );
        assert!(
            result.is_ok(),
            "Valid calibration_source '{}' should be accepted",
            source
        );
    }

    // Invalid enum value should fail
    let result = conn.execute(
        "INSERT INTO voice_profiles (tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES (5.0, 7.0, 15.0, 12.0, 60, 40, '[]', 10, 'InvalidSource')",
        [],
    );
    assert!(
        result.is_err(),
        "Invalid calibration_source should be rejected"
    );
}

/// Test UNIQUE constraint on user_id prevents duplicate rows
#[test]
fn test_user_id_unique_constraint() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // First insert should succeed
    let result = conn.execute(
        "INSERT INTO voice_profiles (user_id, tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES ('test_user', 5.0, 7.0, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet')",
        [],
    );
    assert!(result.is_ok(), "First insert with user_id should succeed");

    // Second insert with same user_id should fail
    let result = conn.execute(
        "INSERT INTO voice_profiles (user_id, tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source)
         VALUES ('test_user', 6.0, 8.0, 16.0, 13.0, 70, 30, '[]', 15, 'QuickCalibration')",
        [],
    );
    assert!(
        result.is_err(),
        "Duplicate user_id should be rejected by UNIQUE constraint"
    );
}

/// Test index on user_id exists for fast lookups (AC-1)
#[test]
fn test_user_id_index_exists() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Query indexes on voice_profiles table
    let index_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type='index' AND name='idx_voice_profiles_user_id' AND tbl_name='voice_profiles'",
            [],
            |row| row.get::<_, i64>(0).map(|count| count == 1),
        )
        .unwrap();

    assert!(
        index_exists,
        "Index idx_voice_profiles_user_id should exist on voice_profiles table"
    );
}

/// Test trigger exists for auto-updating updated_at on row changes (AC-3)
///
/// Note: We verify trigger existence rather than timing-based assertion because
/// SQLite datetime('now') has 1-second resolution, making sub-second tests flaky.
#[test]
fn test_updated_at_trigger_exists() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Verify trigger exists in schema
    let trigger_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type='trigger' AND name='voice_profiles_updated_at' AND tbl_name='voice_profiles'",
            [],
            |row| row.get::<_, i64>(0).map(|count| count == 1),
        )
        .unwrap();

    assert!(
        trigger_exists,
        "Trigger voice_profiles_updated_at should exist on voice_profiles table"
    );

    // Verify trigger SQL references updated_at column
    let trigger_sql: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='trigger' AND name='voice_profiles_updated_at'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert!(
        trigger_sql.contains("updated_at"),
        "Trigger should update the updated_at column"
    );
    assert!(
        trigger_sql.contains("datetime('now')"),
        "Trigger should use datetime('now') for timestamp"
    );
}

/// Test trigger functionally updates updated_at (timing-tolerant version)
#[test]
fn test_updated_at_trigger_functional() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::new(db_path.clone(), None).unwrap();
    let conn = Connection::open(&db_path).unwrap();

    // Insert row with explicit past timestamp to avoid timing issues
    conn.execute(
        "INSERT INTO voice_profiles (user_id, tone_score, technical_depth, avg_sentence_length, vocabulary_complexity,
            structure_paragraphs_pct, structure_bullets_pct, common_phrases, sample_count, calibration_source, updated_at)
         VALUES ('trigger_test', 5.0, 7.0, 15.0, 12.0, 60, 40, '[]', 10, 'GoldenSet', '2020-01-01 00:00:00')",
        [],
    ).unwrap();

    // Verify initial timestamp is in the past
    let updated_at_before: String = conn
        .query_row(
            "SELECT updated_at FROM voice_profiles WHERE user_id = 'trigger_test'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(updated_at_before, "2020-01-01 00:00:00");

    // Update the row (trigger should fire)
    conn.execute(
        "UPDATE voice_profiles SET tone_score = 6.0 WHERE user_id = 'trigger_test'",
        [],
    )
    .unwrap();

    // Verify updated_at changed from the past value
    let updated_at_after: String = conn
        .query_row(
            "SELECT updated_at FROM voice_profiles WHERE user_id = 'trigger_test'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_ne!(
        updated_at_before, updated_at_after,
        "updated_at should change after UPDATE"
    );
    assert!(
        updated_at_after.as_str() > "2020-01-01",
        "updated_at should be updated to current time (after 2020)"
    );
}
