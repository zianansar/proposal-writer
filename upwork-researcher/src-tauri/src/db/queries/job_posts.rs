use rusqlite::{params, Connection, Result};

/// Insert a new job post into the database
/// Returns the ID of the newly inserted job post
pub fn insert_job_post(
    conn: &Connection,
    url: Option<&str>,
    raw_content: &str,
    client_name: Option<&str>,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO job_posts (url, raw_content, client_name) VALUES (?1, ?2, ?3)",
        params![url, raw_content, client_name],
    )?;
    Ok(conn.last_insert_rowid())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    #[test]
    fn test_insert_job_post_with_url() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = insert_job_post(
            &conn,
            Some("https://upwork.com/job/123"),
            "Sample job content for web development project",
            None,
        )
        .unwrap();

        assert!(id > 0);

        // Verify the job was saved
        let saved_content: String = conn
            .query_row(
                "SELECT raw_content FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(saved_content, "Sample job content for web development project");
    }

    #[test]
    fn test_insert_job_post_without_url() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = insert_job_post(
            &conn,
            None, // No URL - user pasted text directly
            "Job content without URL",
            None,
        )
        .unwrap();

        assert!(id > 0);

        // Verify url is NULL
        let url: Option<String> = conn
            .query_row(
                "SELECT url FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert!(url.is_none());
    }

    #[test]
    fn test_insert_job_post_with_client_name() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();
        let conn = db.conn.lock().unwrap();

        let id = insert_job_post(
            &conn,
            Some("https://upwork.com/job/456"),
            "Project for TechCorp Inc",
            Some("TechCorp Inc"),
        )
        .unwrap();

        assert!(id > 0);

        // Verify client_name was saved
        let client: Option<String> = conn
            .query_row(
                "SELECT client_name FROM job_posts WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(client, Some("TechCorp Inc".to_string()));
    }
}
