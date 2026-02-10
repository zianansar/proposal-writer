// Test for V26 migration: Add indexes for optimized proposal history queries
// Story 8-7: Memory Optimization for Large Proposal Lists
use rusqlite::{Connection, params};
use std::fs;
use std::path::Path;
use std::time::Instant;

#[test]
fn test_migration_v26_using_actual_file() {
    let conn = Connection::open_in_memory().unwrap();

    // Create base proposals table (from V1)
    conn.execute(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_content TEXT,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();

    // Read and apply the actual V26 migration file
    let migration_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("migrations")
        .join("V26__add_proposal_history_indexes.sql");

    let migration_sql = fs::read_to_string(&migration_path)
        .expect("Failed to read V26 migration file");

    // Execute migration SQL (skip comments and empty lines)
    for line in migration_sql.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("--") && !trimmed.is_empty() {
            conn.execute(trimmed, [])
                .expect("Failed to execute migration SQL");
        }
    }

    // Verify indexes exist
    let index_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND (name='idx_proposals_created_at' OR name='idx_proposals_id_created')",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(index_count, 2, "Both indexes should be created");
}

#[test]
fn test_migration_v26_creates_created_at_index() {
    let conn = Connection::open_in_memory().unwrap();

    // Create base proposals table
    conn.execute(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_content TEXT,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();

    // Apply V26 migration
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
         CREATE INDEX IF NOT EXISTS idx_proposals_id_created ON proposals(id, created_at DESC);"
    )
    .unwrap();

    // Verify idx_proposals_created_at exists
    let exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_proposals_created_at'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(exists, 1, "idx_proposals_created_at should exist");
}

#[test]
fn test_migration_v26_creates_composite_index() {
    let conn = Connection::open_in_memory().unwrap();

    // Create base proposals table
    conn.execute(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .unwrap();

    // Apply V26 migration
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
         CREATE INDEX IF NOT EXISTS idx_proposals_id_created ON proposals(id, created_at DESC);"
    )
    .unwrap();

    // Verify idx_proposals_id_created exists
    let exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_proposals_id_created'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(exists, 1, "idx_proposals_id_created should exist");
}

#[test]
fn test_migration_v26_index_used_by_query() {
    let conn = Connection::open_in_memory().unwrap();

    // Create proposals table with indexes
    conn.execute_batch(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_content TEXT,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);
        CREATE INDEX idx_proposals_id_created ON proposals(id, created_at DESC);"
    )
    .unwrap();

    // Insert test data
    for i in 0..10 {
        conn.execute(
            "INSERT INTO proposals (job_url, job_content, generated_text, created_at)
             VALUES (?1, ?2, ?3, datetime('now', '-' || ?4 || ' days'))",
            params![
                format!("http://test{}.com", i),
                format!("Job content {}", i),
                format!("Generated text {}", i),
                i
            ],
        )
        .unwrap();
    }

    // AC-4: Verify query uses index with EXPLAIN QUERY PLAN
    let mut stmt = conn
        .prepare(
            "EXPLAIN QUERY PLAN
             SELECT id, SUBSTR(job_content, 1, 100) as job_excerpt,
                    SUBSTR(generated_text, 1, 200) as preview_text, created_at
             FROM proposals
             ORDER BY created_at DESC
             LIMIT 50 OFFSET 0"
        )
        .unwrap();

    let plan: String = stmt
        .query_row([], |row| {
            let detail: String = row.get(3)?;
            Ok(detail)
        })
        .unwrap();

    // Verify the query plan uses the index
    assert!(
        plan.contains("idx_proposals_created_at") || plan.contains("USING INDEX"),
        "Query should use idx_proposals_created_at index. Plan: {}",
        plan
    );
}

#[test]
fn test_migration_v26_query_performance_100_proposals() {
    let conn = Connection::open_in_memory().unwrap();

    // Create proposals table with indexes
    conn.execute_batch(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_content TEXT,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);
        CREATE INDEX idx_proposals_id_created ON proposals(id, created_at DESC);"
    )
    .unwrap();

    // Seed 100 proposals (AC-4: test with 100+ proposals)
    for i in 0..100 {
        conn.execute(
            "INSERT INTO proposals (job_url, job_content, generated_text, created_at)
             VALUES (?1, ?2, ?3, datetime('now', '-' || ?4 || ' seconds'))",
            params![
                format!("http://job{}.com", i),
                format!("This is job content for proposal number {}", i).repeat(5), // ~200 chars
                format!("This is generated proposal text for job {}", i).repeat(10), // ~400 chars
                i
            ],
        )
        .unwrap();
    }

    // AC-4: Verify query completes in <500ms
    let start = Instant::now();

    let mut stmt = conn
        .prepare(
            "SELECT id,
                    SUBSTR(job_content, 1, 100) as job_excerpt,
                    SUBSTR(generated_text, 1, 200) as preview_text,
                    created_at
             FROM proposals
             ORDER BY created_at DESC
             LIMIT 50 OFFSET 0"
        )
        .unwrap();

    let results: Vec<i64> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();

    let elapsed = start.elapsed();

    assert_eq!(results.len(), 50, "Should return 50 results");
    assert!(
        elapsed.as_millis() < 500,
        "Query took {:?}ms, expected <500ms (NFR-17)",
        elapsed.as_millis()
    );
}

#[test]
fn test_migration_v26_pagination_offset_query() {
    let conn = Connection::open_in_memory().unwrap();

    // Create proposals table with indexes
    conn.execute_batch(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_content TEXT,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);
        CREATE INDEX idx_proposals_id_created ON proposals(id, created_at DESC);"
    )
    .unwrap();

    // Insert 150 proposals
    for i in 0..150 {
        conn.execute(
            "INSERT INTO proposals (job_url, job_content, generated_text, created_at)
             VALUES (?1, ?2, ?3, datetime('now', '-' || ?4 || ' seconds'))",
            params![
                format!("http://job{}.com", i),
                format!("Job {}", i),
                format!("Proposal {}", i),
                i
            ],
        )
        .unwrap();
    }

    // Test pagination: page 1 (offset 0)
    let mut stmt = conn
        .prepare(
            "SELECT id FROM proposals
             ORDER BY created_at DESC
             LIMIT 50 OFFSET 0"
        )
        .unwrap();

    let page1: Vec<i64> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();

    assert_eq!(page1.len(), 50);

    // Test pagination: page 2 (offset 50)
    let mut stmt = conn
        .prepare(
            "SELECT id FROM proposals
             ORDER BY created_at DESC
             LIMIT 50 OFFSET 50"
        )
        .unwrap();

    let page2: Vec<i64> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();

    assert_eq!(page2.len(), 50);

    // Verify no overlap between pages
    assert!(page1.iter().all(|id| !page2.contains(id)), "Pages should not overlap");
}

#[test]
fn test_migration_v26_selective_column_loading() {
    let conn = Connection::open_in_memory().unwrap();

    // Create proposals table with both lightweight and heavy columns
    conn.execute_batch(
        "CREATE TABLE proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_url TEXT NOT NULL,
            job_content TEXT,
            generated_text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            full_job_content TEXT,
            revision_history TEXT
        );
        CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);"
    )
    .unwrap();

    // Insert proposal with heavy data
    conn.execute(
        "INSERT INTO proposals (job_url, job_content, generated_text, full_job_content, revision_history)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            "http://test.com",
            "Short job content",
            "Short generated text",
            "X".repeat(10000), // Heavy column
            "X".repeat(5000),  // Heavy column
        ],
    )
    .unwrap();

    // AC-6: Query should NOT select heavy columns
    let mut stmt = conn
        .prepare(
            "SELECT id,
                    SUBSTR(job_content, 1, 100) as job_excerpt,
                    SUBSTR(generated_text, 1, 200) as preview_text,
                    created_at
             FROM proposals
             ORDER BY created_at DESC
             LIMIT 50"
        )
        .unwrap();

    // Verify only 4 columns returned (NOT including full_job_content, revision_history)
    assert_eq!(stmt.column_count(), 4, "Should only select 4 lightweight columns");

    // Verify query returns correct data
    let row = stmt.query_row([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    }).unwrap();

    assert_eq!(row.0, 1); // id
    assert_eq!(row.1, "Short job content"); // job_excerpt (truncated in SQL)
    assert_eq!(row.2, "Short generated text"); // preview_text (truncated in SQL)
}
