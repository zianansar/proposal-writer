//! Golden Set Proposals CRUD operations for Story 5.3
//! Supports voice calibration (FR-16, Epic 5)
//! Privacy: All proposal text stays LOCAL - never sent to API (AR-12)

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

/// Golden set proposal for voice learning calibration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GoldenProposal {
    pub id: i64,
    pub content: String,
    pub word_count: i64,
    pub source_filename: Option<String>,
    pub created_at: String,
}

/// Minimum word count for valid proposal (AC-4)
const MIN_WORD_COUNT: usize = 200;

/// Maximum number of golden proposals allowed (validation rules)
const MAX_PROPOSALS: i64 = 5;

/// Add a new golden proposal to the set
/// Returns proposal ID on success, error if word count < 200 or max 5 reached
pub fn add_golden_proposal(
    conn: &Connection,
    content: &str,
    source_filename: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    // Validate maximum 5 proposals (validation rules)
    let current_count = get_golden_proposal_count(conn)?;
    if current_count >= MAX_PROPOSALS {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
            Some(format!("Maximum {} proposals allowed", MAX_PROPOSALS)),
        ));
    }

    // AC-4: Validate minimum 200 words
    let word_count = content.split_whitespace().count();
    if word_count < MIN_WORD_COUNT {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
            Some(format!(
                "Proposal must be at least {} words (currently: {})",
                MIN_WORD_COUNT, word_count
            )),
        ));
    }

    // Insert proposal with word count
    conn.execute(
        "INSERT INTO golden_set_proposals (content, word_count, source_filename) VALUES (?, ?, ?)",
        params![content, word_count as i64, source_filename],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Get all golden proposals ordered by created_at DESC (newest first)
pub fn get_golden_proposals(conn: &Connection) -> Result<Vec<GoldenProposal>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, content, word_count, source_filename, created_at
         FROM golden_set_proposals
         ORDER BY created_at DESC",
    )?;

    let proposals = stmt
        .query_map([], |row| {
            Ok(GoldenProposal {
                id: row.get(0)?,
                content: row.get(1)?,
                word_count: row.get(2)?,
                source_filename: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(proposals)
}

/// Delete a golden proposal by ID
pub fn delete_golden_proposal(conn: &Connection, id: i64) -> Result<(), rusqlite::Error> {
    let rows_affected = conn.execute("DELETE FROM golden_set_proposals WHERE id = ?", params![id])?;

    if rows_affected == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
}

/// Get count of golden proposals
pub fn get_golden_proposal_count(conn: &Connection) -> Result<i64, rusqlite::Error> {
    conn.query_row("SELECT COUNT(*) FROM golden_set_proposals", [], |row| {
        row.get(0)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        // Create golden_set_proposals table (matches V20 migration)
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS golden_set_proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                source_filename TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_golden_set_created_at
            ON golden_set_proposals(created_at DESC);
            "#,
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_add_golden_proposal_valid() {
        // Subtask 5.2: Test add/get/delete CRUD operations
        let conn = setup_test_db();

        // Create 200+ word proposal
        let content = "word ".repeat(200); // 200 words
        let proposal_id = add_golden_proposal(&conn, &content, Some("test.txt")).unwrap();

        assert!(proposal_id > 0, "Should return positive proposal ID");

        // Verify proposal was inserted
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM golden_set_proposals WHERE id = ?",
                params![proposal_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "Proposal should be inserted once");
    }

    #[test]
    fn test_add_golden_proposal_below_minimum() {
        // Subtask 5.3: Test word count validation (reject <200 words)
        let conn = setup_test_db();

        // Create 150 word proposal (below minimum)
        let content = "word ".repeat(150); // 150 words
        let result = add_golden_proposal(&conn, &content, None);

        assert!(result.is_err(), "Should reject proposal with < 200 words");

        if let Err(rusqlite::Error::SqliteFailure(_, Some(msg))) = result {
            assert!(msg.contains("200"), "Error should mention minimum word count");
            assert!(msg.contains("150"), "Error should show current word count");
        }
    }

    #[test]
    fn test_add_golden_proposal_exactly_200_words() {
        // Test edge case: exactly 200 words should be accepted
        let conn = setup_test_db();

        let content = "word ".repeat(200); // 200 words exactly
        let result = add_golden_proposal(&conn, &content, None);

        assert!(result.is_ok(), "Should accept proposal with exactly 200 words");
    }

    #[test]
    fn test_get_golden_proposals_ordered() {
        // Subtask 5.2: Test get_golden_proposals returns all proposals
        let conn = setup_test_db();

        // Insert proposals with explicit timestamps
        let content = "word ".repeat(200); // 200 words

        conn.execute(
            "INSERT INTO golden_set_proposals (content, word_count, source_filename, created_at) VALUES (?, ?, ?, ?)",
            params![content, 200, Some("first.txt"), "2024-01-01 10:00:00"],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO golden_set_proposals (content, word_count, source_filename, created_at) VALUES (?, ?, ?, ?)",
            params![content, 200, Some("second.txt"), "2024-01-01 10:00:01"],
        )
        .unwrap();

        let proposals = get_golden_proposals(&conn).unwrap();

        assert_eq!(proposals.len(), 2, "Should return 2 proposals");
        assert_eq!(
            proposals[0].source_filename.as_deref(),
            Some("second.txt"),
            "Newest proposal should be first"
        );
        assert_eq!(
            proposals[1].source_filename.as_deref(),
            Some("first.txt"),
            "Oldest proposal should be last"
        );
    }

    #[test]
    fn test_get_golden_proposals_empty() {
        // Test get_golden_proposals with empty table
        let conn = setup_test_db();

        let proposals = get_golden_proposals(&conn).unwrap();
        assert_eq!(proposals.len(), 0, "Should return empty array for no proposals");
    }

    #[test]
    fn test_delete_golden_proposal_valid() {
        // Subtask 5.2: Test delete_golden_proposal removes by ID
        let conn = setup_test_db();

        let content = "word ".repeat(200); // 200 words
        let proposal_id = add_golden_proposal(&conn, &content, None).unwrap();

        delete_golden_proposal(&conn, proposal_id).unwrap();

        // Verify proposal was deleted
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM golden_set_proposals WHERE id = ?",
                params![proposal_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "Proposal should be deleted");
    }

    #[test]
    fn test_delete_golden_proposal_non_existent() {
        // Test delete_golden_proposal with non-existent ID
        let conn = setup_test_db();

        let result = delete_golden_proposal(&conn, 99999);
        assert!(result.is_err(), "Should return error for non-existent proposal");
    }

    #[test]
    fn test_get_golden_proposal_count() {
        // Subtask 5.2: Test get_golden_proposal_count returns correct count
        let conn = setup_test_db();

        // Initially empty
        let count = get_golden_proposal_count(&conn).unwrap();
        assert_eq!(count, 0, "Should return 0 for empty table");

        // Add 3 proposals
        let content = "word ".repeat(200); // 200 words
        add_golden_proposal(&conn, &content, Some("1.txt")).unwrap();
        add_golden_proposal(&conn, &content, Some("2.txt")).unwrap();
        add_golden_proposal(&conn, &content, Some("3.txt")).unwrap();

        let count = get_golden_proposal_count(&conn).unwrap();
        assert_eq!(count, 3, "Should return 3 after adding 3 proposals");

        // Delete one
        let proposals = get_golden_proposals(&conn).unwrap();
        delete_golden_proposal(&conn, proposals[0].id).unwrap();

        let count = get_golden_proposal_count(&conn).unwrap();
        assert_eq!(count, 2, "Should return 2 after deleting 1 proposal");
    }

    #[test]
    fn test_word_count_stored_correctly() {
        // Verify word_count is calculated and stored correctly
        let conn = setup_test_db();

        let content = "word ".repeat(200); // 200 words
        let proposal_id = add_golden_proposal(&conn, &content, None).unwrap();

        let proposals = get_golden_proposals(&conn).unwrap();
        let proposal = proposals.iter().find(|p| p.id == proposal_id).unwrap();

        assert_eq!(proposal.word_count, 200, "Word count should be stored as 200");
    }

    #[test]
    fn test_source_filename_optional() {
        // Test that source_filename is optional (None for pasted text)
        let conn = setup_test_db();

        let content = "word ".repeat(200); // 200 words

        // Without filename (pasted text)
        let id1 = add_golden_proposal(&conn, &content, None).unwrap();

        // With filename (uploaded file)
        let id2 = add_golden_proposal(&conn, &content, Some("uploaded.pdf")).unwrap();

        let proposals = get_golden_proposals(&conn).unwrap();

        let p1 = proposals.iter().find(|p| p.id == id1).unwrap();
        assert_eq!(p1.source_filename, None, "Pasted proposal should have no filename");

        let p2 = proposals.iter().find(|p| p.id == id2).unwrap();
        assert_eq!(
            p2.source_filename.as_deref(),
            Some("uploaded.pdf"),
            "Uploaded proposal should have filename"
        );
    }

    #[test]
    fn test_max_proposals_limit() {
        // Test that maximum 5 proposals are enforced
        let conn = setup_test_db();

        let content = "word ".repeat(200); // 200 words

        // Add 5 proposals (should succeed)
        for i in 1..=5 {
            let result = add_golden_proposal(&conn, &content, Some(&format!("{}.txt", i)));
            assert!(result.is_ok(), "Proposal {} should be accepted", i);
        }

        // 6th proposal should be rejected
        let result = add_golden_proposal(&conn, &content, Some("6.txt"));
        assert!(result.is_err(), "Should reject proposal when max 5 reached");

        if let Err(rusqlite::Error::SqliteFailure(_, Some(msg))) = result {
            assert!(msg.contains("Maximum"), "Error should mention maximum limit");
            assert!(msg.contains("5"), "Error should mention limit of 5");
        }

        // Verify count is still 5
        let count = get_golden_proposal_count(&conn).unwrap();
        assert_eq!(count, 5, "Should have exactly 5 proposals");
    }
}
