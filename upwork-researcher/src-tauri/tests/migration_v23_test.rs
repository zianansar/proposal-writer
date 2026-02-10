// Test for V23 migration: Add revision_type and restored_from_id columns
use rusqlite::{params, Connection};

#[test]
fn test_migration_v23_adds_columns() {
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

    // Create proposal_revisions table with V8 schema (before V23)
    conn.execute(
        "CREATE TABLE proposal_revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            revision_number INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
        )",
        [],
    )
    .unwrap();

    conn.execute(
        "CREATE INDEX idx_proposal_revisions_proposal_id
            ON proposal_revisions(proposal_id)",
        [],
    )
    .unwrap();

    // Apply V23 migration
    conn.execute_batch(
        "ALTER TABLE proposal_revisions ADD COLUMN revision_type TEXT NOT NULL DEFAULT 'edit'
            CHECK (revision_type IN ('generation', 'edit', 'restore'));

        ALTER TABLE proposal_revisions ADD COLUMN restored_from_id INTEGER
            REFERENCES proposal_revisions(id);

        CREATE INDEX IF NOT EXISTS idx_proposal_revisions_proposal_created
            ON proposal_revisions(proposal_id, created_at DESC);

        UPDATE proposal_revisions SET revision_type = 'edit' WHERE revision_type IS NULL;",
    )
    .unwrap();

    // Verify columns exist
    let stmt = conn
        .prepare("SELECT revision_type, restored_from_id FROM proposal_revisions")
        .unwrap();
    assert!(stmt.column_count() == 2);

    // Verify CHECK constraint on revision_type
    conn.execute(
        "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
        [],
    )
    .unwrap();
    let proposal_id = conn.last_insert_rowid();

    // Valid types should work
    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_number, revision_type)
         VALUES (?1, 'Test', 1, 'generation')",
        params![proposal_id],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_number, revision_type)
         VALUES (?1, 'Test', 2, 'edit')",
        params![proposal_id],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_number, revision_type)
         VALUES (?1, 'Test', 3, 'restore')",
        params![proposal_id],
    )
    .unwrap();

    // Invalid type should fail
    let result = conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_number, revision_type)
         VALUES (?1, 'Test', 4, 'invalid')",
        params![proposal_id],
    );
    assert!(result.is_err());

    // Verify index exists
    let index_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type='index' AND name='idx_proposal_revisions_proposal_created'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(index_exists, 1);
}

#[test]
fn test_migration_v23_restored_from_foreign_key() {
    let conn = Connection::open_in_memory().unwrap();

    // Setup tables
    conn.execute(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            generated_text TEXT NOT NULL
        )",
        [],
    )
    .unwrap();

    conn.execute_batch(
        "CREATE TABLE proposal_revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            revision_number INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            revision_type TEXT NOT NULL DEFAULT 'edit'
                CHECK (revision_type IN ('generation', 'edit', 'restore')),
            restored_from_id INTEGER REFERENCES proposal_revisions(id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
        )",
    )
    .unwrap();

    // Insert test data
    conn.execute(
        "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
        [],
    )
    .unwrap();
    let proposal_id = conn.last_insert_rowid();

    // Create original revision
    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_number, revision_type)
         VALUES (?1, 'Original', 1, 'generation')",
        params![proposal_id],
    )
    .unwrap();
    let original_id = conn.last_insert_rowid();

    // Create restore revision with foreign key reference
    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_number, revision_type, restored_from_id)
         VALUES (?1, 'Original', 2, 'restore', ?2)",
        params![proposal_id, original_id],
    )
    .unwrap();
    let restore_id = conn.last_insert_rowid();

    // Verify restored_from_id is set correctly
    let restored_from: Option<i64> = conn
        .query_row(
            "SELECT restored_from_id FROM proposal_revisions WHERE id = ?1",
            params![restore_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(restored_from, Some(original_id));
}
