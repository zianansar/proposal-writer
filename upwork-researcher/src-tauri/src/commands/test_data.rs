// Test data seeding commands for performance benchmarks
// Story 8.10: Performance Validation Tests

use crate::db::Database;
use rusqlite::Connection;
use tauri::State;

/// Seeds the database with test proposals for performance benchmarks
/// Creates realistic proposal data matching production schema
#[tauri::command]
#[specta::specta]
pub async fn seed_proposals(
    database: State<'_, Database>,
    count: i64,
) -> Result<(), String> {
    let mut conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    seed_proposals_internal(&mut conn, count as usize)?;
    Ok(())
}

/// Seeds the database with test job posts for performance benchmarks
#[tauri::command]
#[specta::specta]
pub async fn seed_job_posts(
    database: State<'_, Database>,
    count: i64,
) -> Result<(), String> {
    let mut conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    seed_job_posts_internal(&mut conn, count as usize)?;
    Ok(())
}

/// Clears all test data from the database
/// CAUTION: This will delete ALL data - only use in test environments
#[tauri::command]
#[specta::specta]
pub async fn clear_test_data(database: State<'_, Database>) -> Result<(), String> {
    let mut conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Delete in reverse order of foreign key dependencies
    conn.execute("DELETE FROM proposal_revisions", [])
        .map_err(|e| format!("Failed to clear revisions: {}", e))?;

    conn.execute("DELETE FROM proposals", [])
        .map_err(|e| format!("Failed to clear proposals: {}", e))?;

    conn.execute("DELETE FROM job_scores", [])
        .map_err(|e| format!("Failed to clear job scores: {}", e))?;

    conn.execute("DELETE FROM job_posts", [])
        .map_err(|e| format!("Failed to clear job posts: {}", e))?;

    Ok(())
}

// Internal seeding functions

fn seed_proposals_internal(conn: &mut Connection, count: usize) -> Result<(), String> {
    for i in 0..count {
        let title = format!("Test Proposal {}", i + 1);
        let content = format!("This is test proposal content for benchmark #{}", i + 1);
        let job_text = format!("Test job description for proposal {}", i + 1);

        conn.execute(
            "INSERT INTO proposals (title, content, job_description, timestamp) VALUES (?, ?, ?, datetime('now', '-' || ? || ' hours'))",
            rusqlite::params![title, content, job_text, i % 720], // Spread over 30 days
        )
        .map_err(|e| format!("Failed to insert proposal {}: {}", i, e))?;
    }

    Ok(())
}

fn seed_job_posts_internal(conn: &mut Connection, count: usize) -> Result<(), String> {
    for i in 0..count {
        let title = format!("Test Job {}", i + 1);
        let description = format!("Test job description for benchmark #{}. Looking for skilled developer.", i + 1);
        let client_name = format!("Client{}", i % 50); // 50 unique clients
        let skills = format!("Rust,TypeScript,React");

        conn.execute(
            "INSERT INTO job_posts (title, description, url, client_name, key_skills, posted_at, imported_at)
             VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), datetime('now'))",
            rusqlite::params![
                title,
                description,
                format!("https://upwork.com/job/{}", i),
                client_name,
                skills,
                i % 168, // Spread over 7 days
            ],
        )
        .map_err(|e| format!("Failed to insert job post {}: {}", i, e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        // Create minimal schema for testing
        conn.execute(
            "CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                job_description TEXT,
                timestamp TEXT NOT NULL
            )",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE IF NOT EXISTS job_posts (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                url TEXT,
                client_name TEXT,
                key_skills TEXT,
                posted_at TEXT,
                imported_at TEXT NOT NULL
            )",
            [],
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_seed_proposals() {
        let mut conn = setup_test_db();
        seed_proposals_internal(&mut conn, 10).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 10);
    }

    #[test]
    fn test_seed_job_posts() {
        let mut conn = setup_test_db();
        seed_job_posts_internal(&mut conn, 10).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM job_posts", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 10);
    }

    #[test]
    fn test_large_seed() {
        let mut conn = setup_test_db();

        // Test seeding 500 proposals (benchmark requirement)
        seed_proposals_internal(&mut conn, 500).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0))
            .unwrap();

        assert_eq!(count, 500);
    }
}
