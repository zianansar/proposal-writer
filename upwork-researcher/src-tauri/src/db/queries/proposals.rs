//! Proposal database queries.
//!
//! Provides CRUD operations for the proposals table.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Saved proposal with its database ID (full content)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedProposal {
    pub id: i64,
    pub job_content: String,
    pub generated_text: String,
    pub created_at: String,
    pub status: String,
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
/// Status defaults to 'draft' if not provided.
pub fn insert_proposal(
    conn: &Connection,
    job_content: &str,
    generated_text: &str,
    status: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    let status = status.unwrap_or("draft");
    conn.execute(
        "INSERT INTO proposals (job_content, generated_text, status) VALUES (?1, ?2, ?3)",
        params![job_content, generated_text, status],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Get a proposal by ID.
pub fn get_proposal(conn: &Connection, id: i64) -> Result<Option<SavedProposal>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, job_content, generated_text, created_at, status FROM proposals WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(SavedProposal {
            id: row.get(0)?,
            job_content: row.get(1)?,
            generated_text: row.get(2)?,
            created_at: row.get(3)?,
            status: row.get(4)?,
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

/// Get all proposals with full content for export.
/// Returns all proposals ordered by id ASC (oldest first).
/// No limit - used for backup/export purposes.
pub fn get_all_proposals(conn: &Connection) -> Result<Vec<SavedProposal>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, job_content, generated_text, created_at, status FROM proposals ORDER BY id ASC",
    )?;

    let proposals = stmt
        .query_map([], |row| {
            Ok(SavedProposal {
                id: row.get(0)?,
                job_content: row.get(1)?,
                generated_text: row.get(2)?,
                created_at: row.get(3)?,
                status: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(proposals)
}

/// Get the latest draft proposal (status='draft', most recent created_at).
/// Returns None if no draft exists.
/// Uses id DESC as tiebreaker when timestamps are identical (common in tests).
pub fn get_latest_draft(conn: &Connection) -> Result<Option<SavedProposal>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, job_content, generated_text, created_at, status
         FROM proposals
         WHERE status = 'draft'
         ORDER BY created_at DESC, id DESC
         LIMIT 1",
    )?;

    let mut rows = stmt.query([])?;

    if let Some(row) = rows.next()? {
        Ok(Some(SavedProposal {
            id: row.get(0)?,
            job_content: row.get(1)?,
            generated_text: row.get(2)?,
            created_at: row.get(3)?,
            status: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

/// Update the generated text of a proposal (for draft auto-save).
/// Note: Single UPDATE statements are atomic in SQLite per the transaction semantics.
/// Explicit transactions would require &mut Connection which breaks the API.
pub fn update_proposal_text(
    conn: &Connection,
    id: i64,
    generated_text: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE proposals SET generated_text = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![generated_text, id],
    )?;
    Ok(())
}

/// Update the status of a proposal (e.g., mark draft as completed).
/// Note: Single UPDATE statements are atomic in SQLite per the transaction semantics.
/// Explicit transactions would require &mut Connection which breaks the API.
pub fn update_proposal_status(
    conn: &Connection,
    id: i64,
    status: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE proposals SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

/// Delete a proposal and all its revisions (Story 6.8).
/// Uses CASCADE delete via foreign key constraint on proposal_revisions table.
/// Returns true if a proposal was deleted, false if not found.
///
/// # GDPR Compliance
/// This implements the "right to deletion" requirement from the Round 5 Security Audit.
/// All related data (revisions via CASCADE) is permanently removed.
///
/// # Atomicity
/// DELETE is atomic in SQLite. CASCADE deletes are part of the same transaction.
pub fn delete_proposal(conn: &Connection, id: i64) -> Result<bool, rusqlite::Error> {
    // Delete the proposal - CASCADE will handle revisions
    let rows_affected = conn.execute("DELETE FROM proposals WHERE id = ?1", params![id])?;

    Ok(rows_affected > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::tempdir;

    fn create_test_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        Database::new(db_path, None).unwrap()
    }

    #[test]
    fn test_insert_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job content", "Test generated text", None).unwrap();

        assert!(id > 0);
    }

    #[test]
    fn test_insert_and_get_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let job_content = "Looking for a React developer";
        let generated_text = "I am excited to apply for this position...";

        let id = insert_proposal(&conn, job_content, generated_text, None).unwrap();
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

        let id1 = insert_proposal(&conn, "Job 1", "Proposal 1", None).unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Proposal 2", None).unwrap();
        let id3 = insert_proposal(&conn, "Job 3", "Proposal 3", None).unwrap();

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

        insert_proposal(&conn, "Job content 1", "Generated text 1", None).unwrap();
        insert_proposal(&conn, "Job content 2", "Generated text 2", None).unwrap();

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

        insert_proposal(&conn, "Job", "Long generated text that should not be in summary", None).unwrap();

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
            insert_proposal(&conn, &format!("Job {}", i), &format!("Proposal {}", i), None).unwrap();
        }

        let proposals = list_proposals(&conn).unwrap();

        // Should be limited to 100
        assert_eq!(proposals.len(), 100);
    }

    #[test]
    fn test_get_all_proposals_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposals = get_all_proposals(&conn).unwrap();

        assert!(proposals.is_empty());
    }

    #[test]
    fn test_get_all_proposals_returns_full_content() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let job = "Test job content";
        let generated = "Test generated text that is long";
        insert_proposal(&conn, job, generated, None).unwrap();

        let proposals = get_all_proposals(&conn).unwrap();

        assert_eq!(proposals.len(), 1);
        assert_eq!(proposals[0].job_content, job);
        assert_eq!(proposals[0].generated_text, generated);
        assert!(!proposals[0].created_at.is_empty());
    }

    #[test]
    fn test_get_all_proposals_no_limit() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert 105 proposals
        for i in 0..105 {
            insert_proposal(&conn, &format!("Job {}", i), &format!("Proposal {}", i), None).unwrap();
        }

        let proposals = get_all_proposals(&conn).unwrap();

        // Should return ALL proposals (no limit)
        assert_eq!(proposals.len(), 105);
    }

    #[test]
    fn test_get_all_proposals_ordered_by_id_asc() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "First job", "First proposal", None).unwrap();
        let id2 = insert_proposal(&conn, "Second job", "Second proposal", None).unwrap();
        let id3 = insert_proposal(&conn, "Third job", "Third proposal", None).unwrap();

        let proposals = get_all_proposals(&conn).unwrap();

        // Oldest first (ASC order by created_at, which correlates with id for same-session inserts)
        // Note: When timestamps are identical, SQLite may return any order, so we verify by id
        assert_eq!(proposals.len(), 3);
        assert_eq!(proposals[0].id, id1);
        assert_eq!(proposals[1].id, id2);
        assert_eq!(proposals[2].id, id3);
    }

    #[test]
    fn test_insert_draft() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", Some("draft")).unwrap();
        let proposal = get_proposal(&conn, id).unwrap().unwrap();

        assert_eq!(proposal.status, "draft");
    }

    #[test]
    fn test_insert_defaults_to_draft() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();
        let proposal = get_proposal(&conn, id).unwrap().unwrap();

        assert_eq!(proposal.status, "draft");
    }

    #[test]
    fn test_insert_completed() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", Some("completed")).unwrap();
        let proposal = get_proposal(&conn, id).unwrap().unwrap();

        assert_eq!(proposal.status, "completed");
    }

    #[test]
    fn test_get_latest_draft_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let draft = get_latest_draft(&conn).unwrap();

        assert!(draft.is_none());
    }

    #[test]
    fn test_get_latest_draft_returns_most_recent() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let _id1 = insert_proposal(&conn, "Job 1", "Proposal 1", Some("draft")).unwrap();
        let _id2 = insert_proposal(&conn, "Job 2", "Proposal 2", Some("draft")).unwrap();
        let id3 = insert_proposal(&conn, "Job 3", "Proposal 3", Some("draft")).unwrap();

        let draft = get_latest_draft(&conn).unwrap().unwrap();

        // Should return the most recent draft (id3)
        assert_eq!(draft.id, id3);
        assert_eq!(draft.job_content, "Job 3");
    }

    #[test]
    fn test_get_latest_draft_ignores_completed() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job 1", "Proposal 1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Proposal 2", Some("draft")).unwrap();
        insert_proposal(&conn, "Job 3", "Proposal 3", Some("completed")).unwrap();

        let draft = get_latest_draft(&conn).unwrap().unwrap();

        // Should return the only draft (id2), ignoring completed proposals
        assert_eq!(draft.id, id2);
    }

    #[test]
    fn test_no_draft_if_all_completed() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job 1", "Proposal 1", Some("completed")).unwrap();
        insert_proposal(&conn, "Job 2", "Proposal 2", Some("completed")).unwrap();

        let draft = get_latest_draft(&conn).unwrap();

        assert!(draft.is_none());
    }

    #[test]
    fn test_update_proposal_text() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Job", "Initial text", Some("draft")).unwrap();

        update_proposal_text(&conn, id, "Updated text").unwrap();

        let proposal = get_proposal(&conn, id).unwrap().unwrap();
        assert_eq!(proposal.generated_text, "Updated text");
    }

    #[test]
    fn test_update_proposal_status() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Job", "Text", Some("draft")).unwrap();

        update_proposal_status(&conn, id, "completed").unwrap();

        let proposal = get_proposal(&conn, id).unwrap().unwrap();
        assert_eq!(proposal.status, "completed");
    }

    #[test]
    fn test_update_status_draft_to_completed() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Job", "Text", Some("draft")).unwrap();

        // Verify it's a draft
        let draft = get_latest_draft(&conn).unwrap().unwrap();
        assert_eq!(draft.id, id);

        // Mark as completed
        update_proposal_status(&conn, id, "completed").unwrap();

        // Verify no draft exists anymore
        let no_draft = get_latest_draft(&conn).unwrap();
        assert!(no_draft.is_none());
    }

    // =========================================================================
    // Story 6.8: Delete Proposal tests
    // =========================================================================

    #[test]
    fn test_delete_proposal_existing() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Job to delete", "Text to delete", None).unwrap();

        // Verify it exists
        assert!(get_proposal(&conn, id).unwrap().is_some());

        // Delete it
        let deleted = delete_proposal(&conn, id).unwrap();
        assert!(deleted, "Should return true when proposal is deleted");

        // Verify it's gone
        assert!(get_proposal(&conn, id).unwrap().is_none());
    }

    #[test]
    fn test_delete_proposal_nonexistent() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Try to delete non-existent proposal
        let deleted = delete_proposal(&conn, 99999).unwrap();
        assert!(!deleted, "Should return false when proposal doesn't exist");
    }

    #[test]
    fn test_delete_proposal_does_not_affect_others() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "Job 1", "Proposal 1", None).unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Proposal 2", None).unwrap();
        let id3 = insert_proposal(&conn, "Job 3", "Proposal 3", None).unwrap();

        // Delete the middle one
        let deleted = delete_proposal(&conn, id2).unwrap();
        assert!(deleted);

        // Verify others still exist
        assert!(get_proposal(&conn, id1).unwrap().is_some());
        assert!(get_proposal(&conn, id2).unwrap().is_none());
        assert!(get_proposal(&conn, id3).unwrap().is_some());

        // Verify list count
        let proposals = list_proposals(&conn).unwrap();
        assert_eq!(proposals.len(), 2);
    }

    #[test]
    fn test_delete_proposal_cascades_to_revisions() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Create a proposal
        let proposal_id = insert_proposal(&conn, "Job with revisions", "Original text", None).unwrap();

        // Insert revisions directly (proposal_revisions table from V8 migration)
        conn.execute(
            "INSERT INTO proposal_revisions (proposal_id, content, revision_number) VALUES (?1, ?2, ?3)",
            params![proposal_id, "Revision 1 content", 1],
        ).unwrap();
        conn.execute(
            "INSERT INTO proposal_revisions (proposal_id, content, revision_number) VALUES (?1, ?2, ?3)",
            params![proposal_id, "Revision 2 content", 2],
        ).unwrap();

        // Verify revisions exist
        let revision_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = ?1",
            params![proposal_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(revision_count, 2, "Should have 2 revisions before delete");

        // Delete the proposal
        let deleted = delete_proposal(&conn, proposal_id).unwrap();
        assert!(deleted);

        // Verify revisions are CASCADE deleted
        let revision_count_after: i64 = conn.query_row(
            "SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = ?1",
            params![proposal_id],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(revision_count_after, 0, "Revisions should be CASCADE deleted");
    }
}
