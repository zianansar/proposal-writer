//! Proposal History commands for Story 8.7
//!
//! Provides Tauri commands for querying proposal history with pagination and virtualization support.

use crate::db::Database;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

/// Lightweight proposal list item (AC-6: excludes heavy columns)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalListItem {
    pub id: i64,
    pub job_excerpt: String,   // First 100 chars of job_content
    pub preview_text: String,   // First 200 chars of generated_text
    pub created_at: String,
}

/// Paginated response with metadata (AC-4, AC-5)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalHistoryResponse {
    pub proposals: Vec<ProposalListItem>,
    pub total_count: u32,
    pub has_more: bool,
}

/// Internal function to query proposal history (testable without Tauri State)
fn query_proposal_history_internal(
    conn: &Connection,
    limit: u32,
    offset: u32,
) -> Result<ProposalHistoryResponse, String> {
    // Count total proposals
    let total_count: u32 = conn
        .query_row("SELECT COUNT(*) as count FROM proposals", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|e| format!("Failed to count proposals: {}", e))?
        as u32;

    // AC-6: Select ONLY lightweight columns (NOT generated_text, full_job_content, revision_history)
    // AC-4: Use indexed created_at column with DESC order
    // Secondary sort by id DESC for deterministic ordering when timestamps are identical
    let query = "
        SELECT
            id,
            SUBSTR(COALESCE(job_content, ''), 1, 100) as job_excerpt,
            SUBSTR(COALESCE(generated_text, ''), 1, 200) as preview_text,
            created_at
        FROM proposals
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
    ";

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare proposal history query: {}", e))?;

    let proposals_iter = stmt
        .query_map([limit as i64, offset as i64], |row| {
            Ok(ProposalListItem {
                id: row.get(0)?,
                job_excerpt: row.get(1)?,
                preview_text: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to execute proposal history query: {}", e))?;

    let mut proposals = Vec::new();
    for proposal in proposals_iter {
        proposals.push(proposal.map_err(|e| format!("Failed to read proposal row: {}", e))?);
    }

    // AC-5: Determine if more pages available
    let has_more = (offset + limit) < total_count;

    Ok(ProposalHistoryResponse {
        proposals,
        total_count,
        has_more,
    })
}

/// Get paginated proposal history for virtualized list (Story 8.7)
///
/// # Arguments
/// * `limit` - Number of proposals to return (typically 50)
/// * `offset` - Number of proposals to skip (for pagination)
///
/// # Returns
/// ProposalHistoryResponse with lightweight proposal items, total count, and has_more flag
///
/// # Performance
/// AC-4: Uses idx_proposals_created_at index for fast sorting (<500ms with 100+ proposals)
/// AC-6: Selects only lightweight columns (id, job_excerpt, preview_text, created_at)
///
/// # Example
/// ```typescript
/// const result = await invoke<ProposalHistoryResponse>('get_proposal_history', {
///   limit: 50,
///   offset: 0,
/// });
/// ```
#[tauri::command]
pub async fn get_proposal_history(
    db: State<'_, Database>,
    limit: u32,
    offset: u32,
) -> Result<ProposalHistoryResponse, String> {
    let start = std::time::Instant::now();

    // Get connection
    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    // Query using internal function
    let response = query_proposal_history_internal(&conn_guard, limit, offset)?;

    // AC-4: Log query performance (NFR-17: <500ms)
    let elapsed = start.elapsed();
    info!(
        "Proposal history query: {:?} ({} proposals, offset {})",
        elapsed,
        response.proposals.len(),
        offset
    );

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::proposals::insert_proposal;
    use tempfile::tempdir;

    fn create_test_db() -> crate::db::Database {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        crate::db::Database::new(db_path, None).unwrap()
    }

    #[test]
    fn test_get_proposal_history_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 0);
        assert_eq!(result.total_count, 0);
        assert!(!result.has_more);
    }

    #[test]
    fn test_get_proposal_history_pagination() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert 75 proposals
        for i in 0..75 {
            insert_proposal(
                &conn,
                &format!("Job content {}", i),
                &format!("Generated text {}", i),
                None,
            )
            .unwrap();
        }

        // Page 1: limit 50, offset 0
        let page1 = query_proposal_history_internal(&conn, 50, 0).unwrap();
        assert_eq!(page1.proposals.len(), 50);
        assert_eq!(page1.total_count, 75);
        assert!(page1.has_more); // 75 - 50 = 25 remaining

        // Page 2: limit 50, offset 50
        let page2 = query_proposal_history_internal(&conn, 50, 50).unwrap();
        assert_eq!(page2.proposals.len(), 25); // Only 25 remaining
        assert_eq!(page2.total_count, 75);
        assert!(!page2.has_more); // No more pages
    }

    #[test]
    fn test_get_proposal_history_selective_columns() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let job_content = "X".repeat(500); // 500 chars
        let generated_text = "Y".repeat(500); // 500 chars

        insert_proposal(&conn, &job_content, &generated_text, None).unwrap();

        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 1);
        let proposal = &result.proposals[0];

        // AC-6: Verify truncation (job_excerpt max 100 chars, preview_text max 200 chars)
        assert_eq!(proposal.job_excerpt.len(), 100);
        assert_eq!(proposal.preview_text.len(), 200);
        assert_eq!(proposal.job_excerpt, "X".repeat(100));
        assert_eq!(proposal.preview_text, "Y".repeat(200));
    }

    #[test]
    fn test_get_proposal_history_order_desc() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert proposals (most recent will have higher ID)
        let id1 = insert_proposal(&conn, "Job 1", "Text 1", None).unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Text 2", None).unwrap();
        let id3 = insert_proposal(&conn, "Job 3", "Text 3", None).unwrap();

        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();

        // AC-4: Should be ordered by created_at DESC (newest first)
        // For same-timestamp inserts, expect reverse ID order
        assert_eq!(result.proposals.len(), 3);
        assert_eq!(result.proposals[0].id, id3); // Newest
        assert_eq!(result.proposals[1].id, id2);
        assert_eq!(result.proposals[2].id, id1); // Oldest
    }

    #[test]
    fn test_get_proposal_history_performance_100_proposals() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Seed 100 proposals (AC-4: test with 100+ proposals)
        for i in 0..100 {
            insert_proposal(
                &conn,
                &format!("Job content for proposal {}", i).repeat(5), // ~200 chars
                &format!("Generated proposal text for job {}", i).repeat(10), // ~400 chars
                None,
            )
            .unwrap();
        }

        let start = std::time::Instant::now();
        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();
        let elapsed = start.elapsed();

        // AC-4: Query should complete in <500ms (NFR-17)
        assert!(
            elapsed.as_millis() < 500,
            "Query took {:?}ms, expected <500ms (NFR-17)",
            elapsed.as_millis()
        );

        assert_eq!(result.proposals.len(), 50);
        assert_eq!(result.total_count, 100);
        assert!(result.has_more);
    }

    #[test]
    fn test_get_proposal_history_has_more_flag() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert 100 proposals
        for i in 0..100 {
            insert_proposal(&conn, &format!("Job {}", i), &format!("Text {}", i), None).unwrap();
        }

        // Test has_more = true (offset + limit < total_count)
        let result1 = query_proposal_history_internal(&conn, 50, 0).unwrap();
        assert!(result1.has_more); // 0 + 50 < 100

        // Test has_more = true (offset + limit < total_count)
        let result2 = query_proposal_history_internal(&conn, 50, 25).unwrap();
        assert!(result2.has_more); // 25 + 50 < 100

        // Test has_more = false (offset + limit >= total_count)
        let result3 = query_proposal_history_internal(&conn, 50, 50).unwrap();
        assert!(!result3.has_more); // 50 + 50 >= 100

        // Test has_more = false (offset + limit > total_count)
        let result4 = query_proposal_history_internal(&conn, 50, 75).unwrap();
        assert!(!result4.has_more); // 75 + 50 > 100
    }

    #[test]
    fn test_get_proposal_history_handles_empty_content() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert proposal with empty job_content (edge case)
        insert_proposal(&conn, "", "Test generated text", None).unwrap();

        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 1);
        assert_eq!(result.proposals[0].job_excerpt, ""); // Empty string truncation
        assert_eq!(result.proposals[0].preview_text, "Test generated text");
    }
}
