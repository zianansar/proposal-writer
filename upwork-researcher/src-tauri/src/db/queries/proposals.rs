//! Proposal database queries.
//!
//! Provides CRUD operations for the proposals table.

use rusqlite::{params, Connection};
use serde::Serialize;

/// Saved proposal with its database ID (full content)
#[derive(Debug, Clone)]
pub struct SavedProposal {
    pub id: i64,
    pub job_content: String,
    pub generated_text: String,
    pub created_at: String,
}

/// Proposal summary for list view (excludes full generated_text for performance)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSummary {
    pub id: i64,
    pub job_content: String,
    pub created_at: String,
}

/// Insert a new proposal into the database.
/// Returns the ID of the inserted proposal.
pub fn insert_proposal(
    conn: &Connection,
    job_content: &str,
    generated_text: &str,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO proposals (job_content, generated_text) VALUES (?1, ?2)",
        params![job_content, generated_text],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Get a proposal by ID.
pub fn get_proposal(conn: &Connection, id: i64) -> Result<Option<SavedProposal>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, job_content, generated_text, created_at FROM proposals WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(SavedProposal {
            id: row.get(0)?,
            job_content: row.get(1)?,
            generated_text: row.get(2)?,
            created_at: row.get(3)?,
        }))
    } else {
        Ok(None)
    }
}

/// List proposals ordered by created_at DESC.
/// Returns summaries without full generated_text for performance.
/// Limited to 100 items per NFR-17 (<500ms load time).
pub fn list_proposals(conn: &Connection) -> Result<Vec<ProposalSummary>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, job_content, created_at FROM proposals ORDER BY created_at DESC LIMIT 100",
    )?;

    let proposals = stmt
        .query_map([], |row| {
            Ok(ProposalSummary {
                id: row.get(0)?,
                job_content: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(proposals)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.into_path().join("test.db");
        Database::new(db_path).unwrap()
    }

    #[test]
    fn test_insert_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job content", "Test generated text").unwrap();

        assert!(id > 0);
    }

    #[test]
    fn test_insert_and_get_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let job_content = "Looking for a React developer";
        let generated_text = "I am excited to apply for this position...";

        let id = insert_proposal(&conn, job_content, generated_text).unwrap();
        let proposal = get_proposal(&conn, id).unwrap().unwrap();

        assert_eq!(proposal.id, id);
        assert_eq!(proposal.job_content, job_content);
        assert_eq!(proposal.generated_text, generated_text);
        assert!(!proposal.created_at.is_empty());
    }

    #[test]
    fn test_get_nonexistent_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal = get_proposal(&conn, 99999).unwrap();

        assert!(proposal.is_none());
    }

    #[test]
    fn test_multiple_inserts_get_unique_ids() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "Job 1", "Proposal 1").unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Proposal 2").unwrap();
        let id3 = insert_proposal(&conn, "Job 3", "Proposal 3").unwrap();

        assert_ne!(id1, id2);
        assert_ne!(id2, id3);
        assert_eq!(id2, id1 + 1);
        assert_eq!(id3, id2 + 1);
    }

    #[test]
    fn test_list_proposals_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposals = list_proposals(&conn).unwrap();

        assert!(proposals.is_empty());
    }

    #[test]
    fn test_list_proposals_returns_summaries() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job content 1", "Generated text 1").unwrap();
        insert_proposal(&conn, "Job content 2", "Generated text 2").unwrap();

        let proposals = list_proposals(&conn).unwrap();

        assert_eq!(proposals.len(), 2);
        // Both proposals should be present (order may vary if same timestamp)
        let job_contents: Vec<&str> = proposals.iter().map(|p| p.job_content.as_str()).collect();
        assert!(job_contents.contains(&"Job content 1"));
        assert!(job_contents.contains(&"Job content 2"));
    }

    #[test]
    fn test_list_proposals_excludes_generated_text() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job", "Long generated text that should not be in summary").unwrap();

        let proposals = list_proposals(&conn).unwrap();

        assert_eq!(proposals.len(), 1);
        // ProposalSummary only has id, job_content, created_at - no generated_text field
        assert_eq!(proposals[0].job_content, "Job");
        assert!(!proposals[0].created_at.is_empty());
    }

    #[test]
    fn test_list_proposals_limit_100() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert 105 proposals
        for i in 0..105 {
            insert_proposal(&conn, &format!("Job {}", i), &format!("Proposal {}", i)).unwrap();
        }

        let proposals = list_proposals(&conn).unwrap();

        // Should be limited to 100
        assert_eq!(proposals.len(), 100);
    }
}
