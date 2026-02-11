//! Job Queue commands for Story 4b.9
//!
//! Provides Tauri commands for querying the job queue with sorting and filtering.

use crate::db::AppDatabase;
use crate::job::types::{ColorCounts, JobQueueItem, JobQueueResponse, ScoreColor, ScoreFilter, SortField};
use rusqlite::Connection;
use tauri::State;
use tracing::{error, info};

/// [AI-Review Fix H2]: Get counts per color for filter chip labels
fn get_color_counts(conn: &Connection) -> Result<ColorCounts, String> {
    let mut counts = ColorCounts::default();

    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(score_color, 'gray') as color, COUNT(*) as cnt
             FROM job_posts
             GROUP BY COALESCE(score_color, 'gray')",
        )
        .map_err(|e| format!("Failed to prepare color count query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let color: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            Ok((color, count as u32))
        })
        .map_err(|e| format!("Failed to execute color count query: {}", e))?;

    for row in rows {
        let (color, count) = row.map_err(|e| format!("Failed to read color count row: {}", e))?;
        match color.as_str() {
            "green" => counts.green = count,
            "yellow" => counts.yellow = count,
            "red" => counts.red = count,
            _ => counts.gray = count,
        }
    }

    Ok(counts)
}

/// Internal function to query job queue (testable without Tauri State)
fn query_job_queue_internal(
    conn: &Connection,
    sort_by: &SortField,
    filter: &ScoreFilter,
    limit: u32,
    offset: u32,
) -> Result<JobQueueResponse, String> {
    // Build SQL query (AC-7: Select only lightweight columns, avoid raw_content, analysis_json)
    let mut query = String::from(
        "SELECT
            id,
            COALESCE(client_name, 'Unknown Client') as client_name,
            COALESCE(job_title, 'Untitled Job') as job_title,
            skills_match_percent,
            client_quality_percent,
            overall_score,
            COALESCE(score_color, 'gray') as score_color,
            created_at
        FROM job_posts",
    );

    // Apply filter (AC-5)
    let filter_clause = match filter {
        ScoreFilter::GreenOnly => " WHERE score_color = 'green'",
        ScoreFilter::YellowAndGreen => " WHERE score_color IN ('green', 'yellow')",
        ScoreFilter::All => "", // No filter
    };
    query.push_str(filter_clause);

    // Apply sort (AC-3) with secondary sort by id for stability
    // [AI-Review Fix M2]: Equal values need secondary sort for deterministic results
    let sort_clause = match sort_by {
        SortField::Score => " ORDER BY overall_score DESC NULLS LAST, id ASC",
        SortField::Date => " ORDER BY created_at DESC, id ASC",
        SortField::ClientName => " ORDER BY client_name ASC, id ASC",
    };
    query.push_str(sort_clause);

    // Apply pagination
    query.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

    // Execute query
    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let jobs_iter = stmt
        .query_map([], |row| {
            Ok(JobQueueItem {
                id: row.get(0)?,
                client_name: row.get(1)?,
                job_title: row.get(2)?,
                skills_match_percent: row.get(3)?,
                client_quality_percent: row.get(4)?,
                overall_score: row.get(5)?,
                score_color: {
                    let color_str: String = row.get(6)?;
                    ScoreColor::from_db_value(&color_str)
                },
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to execute query: {}", e))?;

    let jobs: Vec<JobQueueItem> = jobs_iter
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect jobs: {}", e))?;

    // Get total count for pagination
    let count_query = format!("SELECT COUNT(*) FROM job_posts{}", filter_clause);
    let total_count: i64 = conn
        .query_row(&count_query, [], |row| row.get(0))
        .map_err(|e| format!("Failed to count jobs: {}", e))?;

    // [AI-Review Fix H2]: Get color counts for filter chip labels (AC-5)
    let color_counts = get_color_counts(conn)?;

    let has_more = (offset + jobs.len() as u32) < total_count as u32;

    Ok(JobQueueResponse {
        jobs,
        total_count: total_count as u32,
        has_more,
        color_counts,
    })
}

/// Get job queue with sorting and filtering
/// AC-1: Returns jobs with: client name, job title, skills %, client quality %, overall score, color, date
/// AC-3: Supports sorting by score (default), date, client name
/// AC-5: Supports filtering by color (all, green only, yellow+green)
/// AC-7: Query completes in <500ms even with 100+ jobs (NFR-17)
#[tauri::command]
pub async fn get_job_queue(
    sort_by: SortField,
    filter: ScoreFilter,
    limit: u32,
    offset: u32,
    db: State<'_, AppDatabase>,
) -> Result<JobQueueResponse, String> {
    let db = db.get()?;
    let start = std::time::Instant::now();

    // Lock database connection
    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to lock database: {}", e))?;

    // Call internal function
    let response = query_job_queue_internal(&conn, &sort_by, &filter, limit, offset)?;

    let elapsed = start.elapsed();
    info!(
        "Job queue query: {} jobs returned in {:?} (sort={:?}, filter={:?})",
        response.jobs.len(),
        elapsed,
        sort_by,
        filter
    );

    // Warn if query takes too long (NFR-17: <500ms target)
    if elapsed.as_millis() > 500 {
        error!(
            "Job queue query exceeded 500ms target: {:?} (consider adding indexes)",
            elapsed
        );
    }

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    fn setup_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(db_path, None).unwrap()
    }

    #[allow(dead_code)] // Test helper for future use
    fn insert_test_job(db: &Database, client_name: &str, score: Option<f32>, color: &str) -> i64 {
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO job_posts (
                raw_content, client_name, job_title,
                skills_match_percent, client_quality_percent,
                overall_score, score_color
            ) VALUES (?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                "test content",
                client_name,
                "Test Job",
                75,
                80,
                score,
                color
            ],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn test_query_job_queue_all_filter() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert test jobs
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, job_title, overall_score, score_color) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params!["content", "Client A", "Job A", 90.0, "green"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, job_title, overall_score, score_color) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params!["content", "Client B", "Job B", 70.0, "yellow"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, job_title, overall_score, score_color) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params!["content", "Client C", "Job C", 40.0, "red"],
        )
        .unwrap();

        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::All, 50, 0);

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 3);
        assert_eq!(response.total_count, 3);
        assert_eq!(response.has_more, false);
        // [AI-Review Fix H2]: Verify color counts
        assert_eq!(response.color_counts.green, 1);
        assert_eq!(response.color_counts.yellow, 1);
        assert_eq!(response.color_counts.red, 1);
    }

    #[test]
    fn test_query_job_queue_green_filter() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client A", 90.0, "green"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client B", 70.0, "yellow"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client C", 40.0, "red"],
        )
        .unwrap();

        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::GreenOnly, 50, 0);

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 1);
        assert_eq!(response.jobs[0].score_color, ScoreColor::Green);
    }

    #[test]
    fn test_query_job_queue_yellow_and_green_filter() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client A", 90.0, "green"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client B", 70.0, "yellow"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client C", 40.0, "red"],
        )
        .unwrap();

        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::YellowAndGreen, 50, 0);

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 2);
    }

    #[test]
    fn test_query_job_queue_sort_by_score() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client A", 70.0, "yellow"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client B", 90.0, "green"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Client C", 40.0, "red"],
        )
        .unwrap();

        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::All, 50, 0);

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 3);
        // Highest score first
        assert_eq!(response.jobs[0].overall_score, Some(90.0));
        assert_eq!(response.jobs[1].overall_score, Some(70.0));
        assert_eq!(response.jobs[2].overall_score, Some(40.0));
    }

    #[test]
    fn test_query_job_queue_sort_by_client_name() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Zebra Corp", 70.0, "yellow"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Alpha Inc", 90.0, "green"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
            rusqlite::params!["content", "Beta LLC", 40.0, "red"],
        )
        .unwrap();

        let result = query_job_queue_internal(&conn, &SortField::ClientName, &ScoreFilter::All, 50, 0);

        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 3);
        // Alphabetical order
        assert_eq!(response.jobs[0].client_name, "Alpha Inc");
        assert_eq!(response.jobs[1].client_name, "Beta LLC");
        assert_eq!(response.jobs[2].client_name, "Zebra Corp");
    }

    #[test]
    fn test_query_job_queue_pagination() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert 5 jobs
        for i in 1..=5 {
            conn.execute(
                "INSERT INTO job_posts (raw_content, client_name, overall_score, score_color) VALUES (?, ?, ?, ?)",
                rusqlite::params!["content", format!("Client {}", i), i as f32 * 10.0, "green"],
            )
            .unwrap();
        }

        // First page: limit 2, offset 0
        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::All, 2, 0);
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 2);
        assert_eq!(response.total_count, 5);
        assert_eq!(response.has_more, true);

        // Second page: limit 2, offset 2
        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::All, 2, 2);
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 2);
        assert_eq!(response.total_count, 5);
        assert_eq!(response.has_more, true);

        // Last page: limit 2, offset 4
        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::All, 2, 4);
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 1);
        assert_eq!(response.total_count, 5);
        assert_eq!(response.has_more, false);
    }

    #[test]
    fn test_query_job_queue_empty() {
        let db = setup_test_db();
        let conn = db.conn.lock().unwrap();

        let result = query_job_queue_internal(&conn, &SortField::Score, &ScoreFilter::All, 50, 0);

        if let Err(e) = &result {
            eprintln!("Error: {}", e);
        }
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.jobs.len(), 0);
        assert_eq!(response.total_count, 0);
        assert_eq!(response.has_more, false);
    }
}
