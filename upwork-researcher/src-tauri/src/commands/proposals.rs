//! Proposal History commands for Story 8.7
//!
//! Provides Tauri commands for querying proposal history with pagination and virtualization support.

use crate::db::queries::proposals::ProposalListItem;
use crate::db::AppDatabase;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

/// Paginated response with metadata (AC-4, AC-5)
/// CR L-3: ProposalListItem now defined in db::queries::proposals (single source of truth)
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
    let total_count: u32 =
        conn.query_row("SELECT COUNT(*) as count FROM proposals", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|e| format!("Failed to count proposals: {}", e))? as u32;

    // AC-6: Select ONLY lightweight columns (NOT generated_text, full_job_content, revision_history)
    // AC-4: Use indexed created_at column with DESC order
    // Secondary sort by id DESC for deterministic ordering when timestamps are identical
    // Story 7.1 AC-4: Include outcome_status and hook_strategy_id
    let query = "
        SELECT
            id,
            SUBSTR(COALESCE(job_content, ''), 1, 100) as job_excerpt,
            SUBSTR(COALESCE(generated_text, ''), 1, 200) as preview_text,
            created_at,
            outcome_status,
            hook_strategy_id
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
                outcome_status: row.get(4)?,
                hook_strategy_id: row.get(5)?,
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
    db: State<'_, AppDatabase>,
    limit: u32,
    offset: u32,
) -> Result<ProposalHistoryResponse, String> {
    let db = db.get()?;
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

/// Search proposals with filters and pagination (Story 7.3)
///
/// Supports text search (job content + proposal text), outcome status filter,
/// date range filter, and hook strategy filter. All filters are AND-combined.
///
/// Returns same ProposalHistoryResponse shape as get_proposal_history.
#[tauri::command]
pub async fn search_proposals(
    db: State<'_, AppDatabase>,
    search_text: Option<String>,
    outcome_status: Option<String>,
    date_range_days: Option<u32>,
    hook_strategy: Option<String>,
    limit: u32,
    offset: u32,
) -> Result<ProposalHistoryResponse, String> {
    let db = db.get()?;
    let start = std::time::Instant::now();
    // CR R2 M-1: Cap limit to prevent unbounded result sets
    let limit = limit.min(500);

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    let result = crate::db::queries::proposals::search_proposals(
        &conn_guard,
        search_text.as_deref(),
        outcome_status.as_deref(),
        date_range_days,
        hook_strategy.as_deref(),
        limit,
        offset,
    )
    .map_err(|e| format!("Failed to search proposals: {}", e))?;

    let elapsed = start.elapsed();
    info!(
        "Proposal search query: {:?} ({} results, {} total)",
        elapsed,
        result.proposals.len(),
        result.total_count
    );

    // CR L-3: No mapping needed — both use ProposalListItem from db::queries::proposals
    Ok(ProposalHistoryResponse {
        proposals: result.proposals,
        total_count: result.total_count,
        has_more: result.has_more,
    })
}

/// Get full proposal detail by ID (Story 7.4 AC-1)
///
/// Returns all proposal fields including outcome tracking, hook strategy,
/// linked job title (via LEFT JOIN), and revision count.
#[tauri::command]
pub async fn get_proposal_detail(
    db: State<'_, AppDatabase>,
    id: i64,
) -> Result<crate::db::queries::proposals::ProposalDetail, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::get_proposal_detail(&conn_guard, id)
        .map_err(|e| format!("Failed to get proposal detail: {}", e))?
        .ok_or_else(|| format!("Proposal not found: {}", id))
}

/// Get distinct hook strategy IDs from proposals (Story 7.3)
///
/// Returns list of strategy IDs that exist in the user's proposal data,
/// for populating the hook strategy filter dropdown.
#[tauri::command]
pub async fn get_distinct_hook_strategies(
    db: State<'_, AppDatabase>,
) -> Result<Vec<String>, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::get_distinct_hook_strategies(&conn_guard)
        .map_err(|e| format!("Failed to get hook strategies: {}", e))
}

/// Update proposal outcome status (Story 7.1 AC-1, Story 7.2 AC-2)
///
/// Validates status against VALID_OUTCOME_STATUSES, updates DB, returns success.
/// Called from OutcomeDropdown in both list and detail views.
#[tauri::command]
pub async fn update_proposal_outcome(
    db: State<'_, AppDatabase>,
    proposal_id: i64,
    outcome_status: String,
) -> Result<bool, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::update_proposal_outcome(
        &conn_guard,
        proposal_id,
        &outcome_status,
    )
    .map_err(|e| format!("Failed to update proposal outcome: {}", e))
}

// =========================================================================
// Story 7.5: Analytics Dashboard Commands
// =========================================================================

/// Get proposal analytics summary (Story 7.5 AC-1)
///
/// Returns aggregate metrics including total proposals, response rate,
/// best performing hook strategy, and proposals created this month.
///
/// Excludes draft proposals from all calculations.
#[tauri::command]
pub async fn get_proposal_analytics_summary(
    db: State<'_, AppDatabase>,
) -> Result<crate::db::queries::proposals::AnalyticsSummary, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::get_proposal_analytics_summary(&conn_guard)
        .map_err(|e| format!("Failed to get analytics summary: {}", e))
}

/// Get outcome distribution for bar chart (Story 7.5 AC-2)
///
/// Returns count of proposals per outcome status.
/// Used to render the outcome distribution chart in the analytics dashboard.
#[tauri::command]
pub async fn get_outcome_distribution(
    db: State<'_, AppDatabase>,
) -> Result<Vec<crate::db::queries::proposals::OutcomeCount>, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::get_outcome_distribution(&conn_guard)
        .map_err(|e| format!("Failed to get outcome distribution: {}", e))
}

/// Get response rate by hook strategy (Story 7.5 AC-3)
///
/// Returns performance metrics per hook strategy, sorted by response rate descending.
/// Includes strategies with no hook (strategy = "none").
/// Used for the hook strategy performance chart.
#[tauri::command]
pub async fn get_response_rate_by_strategy(
    db: State<'_, AppDatabase>,
) -> Result<Vec<crate::db::queries::proposals::StrategyPerformance>, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::get_response_rate_by_strategy(&conn_guard)
        .map_err(|e| format!("Failed to get response rate by strategy: {}", e))
}

/// Get weekly proposal activity (Story 7.5 AC-4)
///
/// Returns proposal count and response rate per week for the last N weeks.
/// Default: last 12 weeks.
///
/// # Arguments
/// * `weeks` - Number of weeks to look back (default 12)
#[tauri::command]
pub async fn get_weekly_activity(
    db: State<'_, AppDatabase>,
    weeks: Option<u32>,
) -> Result<Vec<crate::db::queries::proposals::WeeklyActivity>, String> {
    let db = db.get()?;
    let weeks = weeks.unwrap_or(12);

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    crate::db::queries::proposals::get_weekly_activity(&conn_guard, weeks)
        .map_err(|e| format!("Failed to get weekly activity: {}", e))
}

// =========================================================================
// Story 10.4: A/B Testing Analytics (Task 4)
// =========================================================================

/// Strategy effectiveness data for analytics dashboard (Story 10.4: AC-4)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyEffectivenessData {
    pub hook_strategy_id: String,
    pub ab_assigned: bool,
    pub total: i64,
    pub won: i64,
    pub response_rate: f32,
    pub avg_score: f32,
}

/// Get strategy effectiveness grouped by (hook_strategy_id, ab_assigned) (Story 10.4: AC-4)
///
/// Response rate = won / total where won = ['hired', 'interview', 'response_received']
/// Average score: hired=3, interview=2, response_received=1, others=0
/// Sorted by response_rate DESC.
#[tauri::command]
pub async fn get_strategy_effectiveness(
    db: State<'_, AppDatabase>,
) -> Result<Vec<StrategyEffectivenessData>, String> {
    let db = db.get()?;

    let conn_guard = db
        .conn
        .lock()
        .map_err(|e| format!("Failed to acquire database lock: {}", e))?;

    get_strategy_effectiveness_internal(&conn_guard)
        .map_err(|e| format!("Failed to get strategy effectiveness: {}", e))
}

fn get_strategy_effectiveness_internal(
    conn: &Connection,
) -> Result<Vec<StrategyEffectivenessData>, String> {
    let query = "
        SELECT
            hook_strategy_id,
            ab_assigned,
            COUNT(*) as total,
            SUM(CASE WHEN outcome_status IN ('hired', 'interview', 'response_received') THEN 1 ELSE 0 END) as won,
            CAST(SUM(CASE WHEN outcome_status IN ('hired', 'interview', 'response_received') THEN 1 ELSE 0 END) AS REAL)
                / CAST(COUNT(*) AS REAL) as response_rate,
            AVG(CASE
                WHEN outcome_status = 'hired' THEN 3.0
                WHEN outcome_status = 'interview' THEN 2.0
                WHEN outcome_status = 'response_received' THEN 1.0
                ELSE 0.0
            END) as avg_score
        FROM proposals
        WHERE hook_strategy_id IS NOT NULL
        GROUP BY hook_strategy_id, ab_assigned
        ORDER BY response_rate DESC
    ";

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("Failed to prepare strategy effectiveness query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let ab_assigned_int: i64 = row.get(1)?;
            let total: i64 = row.get(2)?;
            let won: i64 = row.get(3)?;
            let response_rate: f64 = row.get(4)?;
            let avg_score: f64 = row.get(5)?;
            Ok(StrategyEffectivenessData {
                hook_strategy_id: row.get(0)?,
                ab_assigned: ab_assigned_int != 0,
                total,
                won,
                response_rate: response_rate as f32,
                avg_score: avg_score as f32,
            })
        })
        .map_err(|e| format!("Failed to execute strategy effectiveness query: {}", e))?;

    let mut results = Vec::new();
    for row in rows {
        results.push(
            row.map_err(|e| format!("Failed to read strategy effectiveness row: {}", e))?,
        );
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::proposals::{insert_proposal, insert_proposal_with_context};
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

    // =========================================================================
    // Story 7.1 AC-4: Verify new fields in proposal history response
    // =========================================================================

    #[test]
    fn test_proposal_history_includes_outcome_status() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert proposal (default outcome_status = 'pending')
        insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 1);
        assert_eq!(
            result.proposals[0].outcome_status, "pending",
            "AC-4: outcome_status should be included in response"
        );
    }

    #[test]
    fn test_proposal_history_includes_hook_strategy_id() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert proposal with hook strategy key (AC-2: stored as snake_case key)
        insert_proposal_with_context(
            &conn,
            "Test job",
            "Test text",
            None,
            Some("social_proof"),
            None,
        )
        .unwrap();

        // Insert proposal without hook strategy
        insert_proposal(&conn, "Job 2", "Text 2", None).unwrap();

        let result = query_proposal_history_internal(&conn, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 2);

        // Find the proposal with strategy (order is DESC by created_at, so last inserted first)
        let with_strategy = result
            .proposals
            .iter()
            .find(|p| p.hook_strategy_id.is_some())
            .expect("Should find proposal with hook strategy");
        assert_eq!(
            with_strategy.hook_strategy_id.as_deref(),
            Some("social_proof"),
            "AC-4: hook_strategy_id should be included in response"
        );

        let without_strategy = result
            .proposals
            .iter()
            .find(|p| p.hook_strategy_id.is_none())
            .expect("Should find proposal without hook strategy");
        assert!(
            without_strategy.hook_strategy_id.is_none(),
            "hook_strategy_id should be null when not set"
        );
    }

    // =========================================================================
    // Story 10.4: Strategy Effectiveness tests (Task 4.13)
    // =========================================================================

    #[test]
    fn test_strategy_effectiveness_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let result = get_strategy_effectiveness_internal(&conn).unwrap();
        assert!(result.is_empty(), "Should return empty for no proposals");
    }

    #[test]
    fn test_strategy_effectiveness_aggregates_correctly() {
        use crate::db::queries::proposals::insert_proposal_with_ab_context;
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert 3 A/B proposals for "social_proof": 2 hired (won), 1 pending (lost)
        insert_proposal_with_ab_context(&conn, "job1", "text1", None, Some("social_proof"), None, true, Some(0.5)).unwrap();
        insert_proposal_with_ab_context(&conn, "job2", "text2", None, Some("social_proof"), None, true, Some(0.5)).unwrap();
        insert_proposal_with_ab_context(&conn, "job3", "text3", None, Some("social_proof"), None, true, Some(0.5)).unwrap();

        // Update outcomes
        conn.execute("UPDATE proposals SET outcome_status='hired' WHERE id=1", []).unwrap();
        conn.execute("UPDATE proposals SET outcome_status='hired' WHERE id=2", []).unwrap();
        // id=3 stays 'pending'

        let results = get_strategy_effectiveness_internal(&conn).unwrap();
        assert_eq!(results.len(), 1, "Should have one row for (social_proof, ab_assigned=true)");

        let row = &results[0];
        assert_eq!(row.hook_strategy_id, "social_proof");
        assert!(row.ab_assigned, "Should be marked ab_assigned=true");
        assert_eq!(row.total, 3);
        assert_eq!(row.won, 2);
        assert!((row.response_rate - 2.0_f32 / 3.0_f32).abs() < 1e-4, "Response rate should be 2/3");
    }

    #[test]
    fn test_strategy_effectiveness_ab_assigned_filtering() {
        use crate::db::queries::proposals::insert_proposal_with_ab_context;
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // A/B proposal for "contrarian"
        insert_proposal_with_ab_context(&conn, "job1", "text1", None, Some("contrarian"), None, true, Some(0.3)).unwrap();
        // Manual proposal for "contrarian"
        insert_proposal_with_ab_context(&conn, "job2", "text2", None, Some("contrarian"), None, false, None).unwrap();

        // Set outcomes
        conn.execute("UPDATE proposals SET outcome_status='response_received' WHERE id=1", []).unwrap();
        conn.execute("UPDATE proposals SET outcome_status='hired' WHERE id=2", []).unwrap();

        let results = get_strategy_effectiveness_internal(&conn).unwrap();

        // Should produce 2 rows: one for (contrarian, ab_assigned=1) and one for (contrarian, ab_assigned=0)
        assert_eq!(results.len(), 2, "A/B and Manual should produce separate rows for same strategy");

        let ab_row = results.iter().find(|r| r.ab_assigned).expect("Should find A/B row");
        let manual_row = results.iter().find(|r| !r.ab_assigned).expect("Should find Manual row");

        assert_eq!(ab_row.total, 1);
        assert_eq!(manual_row.total, 1);
        // manual has hired (score 3.0), ab has response_received (score 1.0)
        assert!((manual_row.avg_score - 3.0_f32).abs() < 1e-4, "Manual hired should have avg_score 3.0");
        assert!((ab_row.avg_score - 1.0_f32).abs() < 1e-4, "A/B response_received should have avg_score 1.0");
    }
}
