// Story 4b.7: RSS Imports Database Queries
// Manages rss_imports table for batch import tracking

use rusqlite::{params, Connection, Result};

/// Create a new RSS import batch record
///
/// Story 4b.8: Added import_method parameter to track fallback source
///
/// Returns the ID of the newly created record
pub fn create_rss_import_batch(
    conn: &Connection,
    batch_id: &str,
    feed_url: &str,
    total_jobs: i64,
    import_method: &str,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO rss_imports (batch_id, feed_url, total_jobs, status, import_method)
         VALUES (?1, ?2, ?3, 'in_progress', ?4)",
        params![batch_id, feed_url, total_jobs, import_method],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Update progress counters for an RSS import batch
pub fn update_rss_import_progress(
    conn: &Connection,
    batch_id: &str,
    analyzed_count: i64,
    failed_count: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE rss_imports 
         SET analyzed_count = ?1, failed_count = ?2
         WHERE batch_id = ?3",
        params![analyzed_count, failed_count, batch_id],
    )?;
    Ok(())
}

/// Mark an RSS import batch as complete
pub fn complete_rss_import_batch(
    conn: &Connection,
    batch_id: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE rss_imports 
         SET status = 'complete', completed_at = datetime('now')
         WHERE batch_id = ?1",
        params![batch_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    #[test]
    fn test_create_rss_import_batch() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = create_rss_import_batch(
            &conn,
            "rss_20260209_120000",
            "https://www.upwork.com/ab/feed/jobs/rss",
            23,
            "rss",
        )
        .unwrap();

        assert!(id > 0);

        // Verify created
        let (batch_id, total, status): (String, i64, String) = conn
            .query_row(
                "SELECT batch_id, total_jobs, status FROM rss_imports WHERE id = ?1",
                params![id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(batch_id, "rss_20260209_120000");
        assert_eq!(total, 23);
        assert_eq!(status, "in_progress");
    }

    #[test]
    fn test_update_rss_import_progress() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        create_rss_import_batch(&conn, "rss_test", "https://example.com/feed", 10, "rss").unwrap();

        update_rss_import_progress(&conn, "rss_test", 5, 1).unwrap();

        let (analyzed, failed): (i64, i64) = conn
            .query_row(
                "SELECT analyzed_count, failed_count FROM rss_imports WHERE batch_id = ?1",
                params!["rss_test"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(analyzed, 5);
        assert_eq!(failed, 1);
    }

    #[test]
    fn test_complete_rss_import_batch() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        create_rss_import_batch(&conn, "rss_complete", "https://example.com/feed", 5, "rss").unwrap();

        complete_rss_import_batch(&conn, "rss_complete").unwrap();

        let (status, completed_at): (String, Option<String>) = conn
            .query_row(
                "SELECT status, completed_at FROM rss_imports WHERE batch_id = ?1",
                params!["rss_complete"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(status, "complete");
        assert!(completed_at.is_some());
    }
}
