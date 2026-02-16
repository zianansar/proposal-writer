// Test for V24 migration: Add archived_revisions column for compressed revision storage
// Story 6-7: Archive Old Revisions
use rusqlite::{params, Connection};
use std::fs;
use std::path::Path;

/// L1 fix: Test using the actual migration file from the migrations folder
#[test]
fn test_migration_v24_using_actual_file() {
    let conn = Connection::open_in_memory().unwrap();

    // Create base proposals table (from V1)
    conn.execute(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();

    // L1: Read and apply the actual V24 migration file
    let migration_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join("V24__add_archived_revisions_column.sql");

    let migration_sql =
        fs::read_to_string(&migration_path).expect("Failed to read V24 migration file");

    // Extract only the SQL statement (skip comments)
    let sql_statements: Vec<&str> = migration_sql
        .lines()
        .filter(|line| !line.trim().starts_with("--") && !line.trim().is_empty())
        .collect();

    for sql in sql_statements {
        conn.execute(sql, [])
            .expect("Failed to execute migration SQL");
    }

    // Verify column exists by selecting from it
    let stmt = conn
        .prepare("SELECT id, archived_revisions FROM proposals")
        .unwrap();
    assert_eq!(stmt.column_count(), 2);

    // Verify we can insert and retrieve BLOB data
    conn.execute(
        "INSERT INTO proposals (job_url, generated_text, archived_revisions)
         VALUES ('http://test.com', 'Test proposal', ?1)",
        params![vec![1u8, 2u8, 3u8]],
    )
    .unwrap();

    let blob: Option<Vec<u8>> = conn
        .query_row(
            "SELECT archived_revisions FROM proposals WHERE job_url = 'http://test.com'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(blob, Some(vec![1u8, 2u8, 3u8]));
}

#[test]
fn test_migration_v24_adds_archived_revisions_column() {
    let conn = Connection::open_in_memory().unwrap();

    // Create base proposals table (from V1)
    conn.execute(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();

    // Apply V24 migration
    conn.execute_batch("ALTER TABLE proposals ADD COLUMN archived_revisions BLOB;")
        .unwrap();

    // Verify column exists by selecting from it
    let stmt = conn
        .prepare("SELECT id, archived_revisions FROM proposals")
        .unwrap();
    assert_eq!(stmt.column_count(), 2);

    // Verify we can insert and retrieve BLOB data
    conn.execute(
        "INSERT INTO proposals (job_url, generated_text, archived_revisions)
         VALUES ('http://test.com', 'Test proposal', ?1)",
        params![vec![1u8, 2u8, 3u8]],
    )
    .unwrap();

    let blob: Option<Vec<u8>> = conn
        .query_row(
            "SELECT archived_revisions FROM proposals WHERE job_url = 'http://test.com'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(blob, Some(vec![1u8, 2u8, 3u8]));
}

#[test]
fn test_migration_v24_archived_revisions_nullable() {
    let conn = Connection::open_in_memory().unwrap();

    // Create proposals table with archived_revisions column
    conn.execute_batch(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            archived_revisions BLOB
        );",
    )
    .unwrap();

    // Insert proposal without archived_revisions (should be NULL)
    conn.execute(
        "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
        [],
    )
    .unwrap();

    let blob: Option<Vec<u8>> = conn
        .query_row(
            "SELECT archived_revisions FROM proposals WHERE job_url = 'http://test.com'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    // Should be NULL/None for new proposals
    assert_eq!(blob, None);
}

#[test]
fn test_migration_v24_update_archived_revisions() {
    let conn = Connection::open_in_memory().unwrap();

    // Setup table
    conn.execute_batch(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            archived_revisions BLOB
        );",
    )
    .unwrap();

    // Insert proposal
    conn.execute(
        "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
        [],
    )
    .unwrap();
    let proposal_id = conn.last_insert_rowid();

    // Update with archived data
    let archive_data = vec![10u8, 20u8, 30u8, 40u8];
    conn.execute(
        "UPDATE proposals SET archived_revisions = ?1 WHERE id = ?2",
        params![archive_data, proposal_id],
    )
    .unwrap();

    // Verify update worked
    let blob: Option<Vec<u8>> = conn
        .query_row(
            "SELECT archived_revisions FROM proposals WHERE id = ?1",
            params![proposal_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(blob, Some(vec![10u8, 20u8, 30u8, 40u8]));
}
