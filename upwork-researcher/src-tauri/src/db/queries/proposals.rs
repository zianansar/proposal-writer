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
/// Story 7.1: Accepts optional hook_strategy_id and job_post_id for outcome tracking.
pub fn insert_proposal(
    conn: &Connection,
    job_content: &str,
    generated_text: &str,
    status: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    insert_proposal_with_context(conn, job_content, generated_text, status, None, None)
}

/// Insert a new proposal with optional hook strategy and job post context (Story 7.1).
/// AC-2: Stores hook_strategy_id (e.g., 'social_proof', 'contrarian').
/// AC-3: Stores job_post_id FK reference to originating job_posts row.
/// Story 10.4 AC-3: Stores ab_assigned and ab_weight_at_assignment for A/B tracking.
pub fn insert_proposal_with_context(
    conn: &Connection,
    job_content: &str,
    generated_text: &str,
    status: Option<&str>,
    hook_strategy_id: Option<&str>,
    job_post_id: Option<i64>,
) -> Result<i64, rusqlite::Error> {
    insert_proposal_with_ab_context(conn, job_content, generated_text, status, hook_strategy_id, job_post_id, false, None)
}

/// Insert a new proposal with A/B testing tracking fields (Story 10.4: AC-3).
///
/// * `ab_assigned` - true if the hook strategy was A/B assigned (false if manually selected)
/// * `ab_weight_at_assignment` - the strategy's ab_weight at generation time; None if manual
pub fn insert_proposal_with_ab_context(
    conn: &Connection,
    job_content: &str,
    generated_text: &str,
    status: Option<&str>,
    hook_strategy_id: Option<&str>,
    job_post_id: Option<i64>,
    ab_assigned: bool,
    ab_weight_at_assignment: Option<f32>,
) -> Result<i64, rusqlite::Error> {
    let status = status.unwrap_or("draft");
    let ab_assigned_int = if ab_assigned { 1i64 } else { 0i64 };
    conn.execute(
        "INSERT INTO proposals (job_content, generated_text, status, hook_strategy_id, job_post_id, ab_assigned, ab_weight_at_assignment)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            job_content,
            generated_text,
            status,
            hook_strategy_id,
            job_post_id,
            ab_assigned_int,
            ab_weight_at_assignment.map(|w| w as f64),
        ],
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

/// Result from search_proposals: list items + total count + has_more flag (Story 7.3).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProposalsResult {
    pub proposals: Vec<ProposalListItem>,
    pub total_count: u32,
    pub has_more: bool,
}

/// Lightweight proposal list item for history views (CR L-3: unified struct, was ProposalListItem + commands::ProposalListItem).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalListItem {
    pub id: i64,
    pub job_excerpt: String,
    pub preview_text: String,
    pub created_at: String,
    pub outcome_status: String,
    pub hook_strategy_id: Option<String>,
}

/// Search proposals with optional filters (Story 7.3).
///
/// Builds a dynamic WHERE clause based on which filters are provided.
/// All filters are AND-combined. Text search uses LIKE on job_content and generated_text.
///
/// Returns `SearchProposalsResult` with matching items, total filtered count, and has_more flag.
pub fn search_proposals(
    conn: &Connection,
    search_text: Option<&str>,
    outcome_status: Option<&str>,
    date_range_days: Option<u32>,
    hook_strategy: Option<&str>,
    limit: u32,
    offset: u32,
) -> Result<SearchProposalsResult, rusqlite::Error> {
    // Build WHERE clauses dynamically
    let mut conditions = vec!["1=1".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    // Text search: LIKE on job_content OR generated_text (case-insensitive via SQLite default)
    // CR M-2: Escape SQL LIKE wildcards (%, _) in user input
    if let Some(text) = search_text {
        if !text.is_empty() {
            let escaped = text
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_");
            let pattern = format!("%{}%", escaped);
            conditions.push(format!(
                "(job_content LIKE ?{p1} ESCAPE '\\' OR generated_text LIKE ?{p2} ESCAPE '\\')",
                p1 = param_values.len() + 1,
                p2 = param_values.len() + 2,
            ));
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern));
        }
    }

    // Outcome status filter
    if let Some(status) = outcome_status {
        if !status.is_empty() {
            conditions.push(format!("outcome_status = ?{}", param_values.len() + 1));
            param_values.push(Box::new(status.to_string()));
        }
    }

    // Date range filter (CR L-2: parameterized via concatenation in SQL)
    if let Some(days) = date_range_days {
        if days > 0 {
            conditions.push(format!(
                "created_at >= datetime('now', '-' || ?{} || ' days')",
                param_values.len() + 1
            ));
            param_values.push(Box::new(days.to_string()));
        }
    }

    // Hook strategy filter
    if let Some(strategy) = hook_strategy {
        if !strategy.is_empty() {
            conditions.push(format!("hook_strategy_id = ?{}", param_values.len() + 1));
            param_values.push(Box::new(strategy.to_string()));
        }
    }

    let where_clause = conditions.join(" AND ");

    // Count query for total filtered results
    let count_sql = format!("SELECT COUNT(*) FROM proposals WHERE {}", where_clause);
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let total_count: u32 = conn.query_row(&count_sql, param_refs.as_slice(), |row| {
        row.get::<_, i64>(0)
    })? as u32;

    // Data query with pagination (CR L-2: limit/offset parameterized)
    let data_sql = format!(
        "SELECT id, SUBSTR(COALESCE(job_content, ''), 1, 100) AS job_excerpt, \
         SUBSTR(COALESCE(generated_text, ''), 1, 200) AS preview_text, \
         created_at, outcome_status, hook_strategy_id \
         FROM proposals WHERE {} \
         ORDER BY created_at DESC, id DESC \
         LIMIT ?{} OFFSET ?{}",
        where_clause,
        param_values.len() + 1,
        param_values.len() + 2
    );

    // Add limit and offset as params
    param_values.push(Box::new(limit as i64));
    param_values.push(Box::new(offset as i64));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&data_sql)?;
    let proposals = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(ProposalListItem {
                id: row.get(0)?,
                job_excerpt: row.get(1)?,
                preview_text: row.get(2)?,
                created_at: row.get(3)?,
                outcome_status: row.get(4)?,
                hook_strategy_id: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let has_more = (offset + limit) < total_count;

    Ok(SearchProposalsResult {
        proposals,
        total_count,
        has_more,
    })
}

/// Get distinct hook strategy IDs from proposals table (Story 7.3).
/// Used to populate the hook strategy filter dropdown with strategies that exist in user data.
pub fn get_distinct_hook_strategies(conn: &Connection) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT hook_strategy_id FROM proposals WHERE hook_strategy_id IS NOT NULL ORDER BY hook_strategy_id ASC"
    )?;
    let strategies = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(strategies)
}

/// Valid outcome_status values per architecture.md (Story 7.1 AC-5).
/// Authoritative source — update architecture.md and V27 SQL comments to match any changes.
const VALID_OUTCOME_STATUSES: &[&str] = &[
    "pending",
    "submitted",
    "response_received",
    "interview",
    "hired",
    "no_response",
    "rejected",
];

/// Update a proposal's outcome status (Story 7.1 AC-5).
/// Validates outcome_status against the allowed enum values.
/// Sets outcome_updated_at to current timestamp.
/// Returns true if proposal was found and updated, false if not found.
pub fn update_proposal_outcome(
    conn: &Connection,
    proposal_id: i64,
    outcome_status: &str,
) -> Result<bool, String> {
    // Validate outcome_status
    if !VALID_OUTCOME_STATUSES.contains(&outcome_status) {
        return Err(format!(
            "Invalid outcome_status '{}'. Valid values: {}",
            outcome_status,
            VALID_OUTCOME_STATUSES.join(", ")
        ));
    }

    let rows_affected = conn
        .execute(
            "UPDATE proposals SET outcome_status = ?1, outcome_updated_at = datetime('now') WHERE id = ?2",
            params![outcome_status, proposal_id],
        )
        .map_err(|e| format!("Failed to update proposal outcome: {}", e))?;

    Ok(rows_affected > 0)
}

/// Full proposal detail for detail view (Story 7.4 AC-1).
/// Includes outcome tracking fields, hook strategy, job post join, and revision count.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalDetail {
    pub id: i64,
    pub job_content: String,
    pub generated_text: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub status: String,
    pub outcome_status: String,
    pub outcome_updated_at: Option<String>,
    pub hook_strategy_id: Option<String>,
    pub job_post_id: Option<i64>,
    pub job_title: Option<String>,
    pub revision_count: i64,
}

/// Get full proposal detail by ID (Story 7.4 AC-1).
/// LEFT JOINs job_posts to get job title (client_name or raw_content substr).
/// Includes a subquery count of proposal_revisions.
pub fn get_proposal_detail(
    conn: &Connection,
    id: i64,
) -> Result<Option<ProposalDetail>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT \
            p.id, \
            p.job_content, \
            p.generated_text, \
            p.created_at, \
            p.updated_at, \
            p.status, \
            p.outcome_status, \
            p.outcome_updated_at, \
            p.hook_strategy_id, \
            p.job_post_id, \
            COALESCE(jp.client_name, SUBSTR(jp.raw_content, 1, 80)) AS job_title, \
            (SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = p.id) AS revision_count \
        FROM proposals p \
        LEFT JOIN job_posts jp ON p.job_post_id = jp.id \
        WHERE p.id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(ProposalDetail {
            id: row.get(0)?,
            job_content: row.get(1)?,
            generated_text: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            status: row.get(5)?,
            outcome_status: row.get(6)?,
            outcome_updated_at: row.get(7)?,
            hook_strategy_id: row.get(8)?,
            job_post_id: row.get(9)?,
            job_title: row.get(10)?,
            revision_count: row.get(11)?,
        }))
    } else {
        Ok(None)
    }
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

// =========================================================================
// Story 7.5: Analytics Dashboard — Aggregate Query Functions
// =========================================================================

/// Analytics summary metrics (Story 7.5 AC-1).
/// Contains total counts, response rate, and best performing strategy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSummary {
    pub total_proposals: i64,
    pub positive_outcomes: i64,
    pub resolved_proposals: i64,
    pub proposals_this_month: i64,
    pub response_rate: f64,
    pub best_strategy: Option<String>,
    pub best_strategy_rate: f64,
}

/// Outcome status distribution for bar chart (Story 7.5 AC-2).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutcomeCount {
    pub outcome_status: String,
    pub count: i64,
}

/// Hook strategy performance metrics (Story 7.5 AC-3).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyPerformance {
    pub strategy: String,
    pub total: i64,
    pub positive: i64,
    pub response_rate: f64,
}

/// Weekly proposal activity and response rate (Story 7.5 AC-4).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyActivity {
    pub week_label: String,
    pub week_start: String,
    pub proposal_count: i64,
    pub positive_count: i64,
    pub response_rate: f64,
}

/// Get proposal analytics summary (Story 7.5 AC-1).
/// Returns aggregate metrics: total proposals, response rate, best strategy, monthly count.
/// Filters: status != 'draft'.
pub fn get_proposal_analytics_summary(
    conn: &Connection,
) -> Result<AnalyticsSummary, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT \
            COUNT(*) as total_proposals, \
            COALESCE(SUM(CASE WHEN outcome_status IN ('response_received','interview','hired') THEN 1 ELSE 0 END), 0) as positive_outcomes, \
            COALESCE(SUM(CASE WHEN outcome_status NOT IN ('pending','submitted') THEN 1 ELSE 0 END), 0) as resolved_proposals, \
            COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as proposals_this_month \
        FROM proposals \
        WHERE status != 'draft'"
    )?;

    let (total_proposals, positive_outcomes, resolved_proposals, proposals_this_month) = stmt
        .query_row([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;

    // Calculate response rate: positive / resolved * 100
    let response_rate = if resolved_proposals > 0 {
        (positive_outcomes as f64 / resolved_proposals as f64) * 100.0
    } else {
        0.0
    };

    // CR R2 M-1: Dedicated LIMIT 1 query instead of fetching all strategies
    let (best_strategy, best_strategy_rate) = conn.query_row(
        "SELECT \
            COALESCE(hook_strategy_id, 'none') as strategy, \
            COUNT(*) as total, \
            SUM(CASE WHEN outcome_status IN ('response_received','interview','hired') THEN 1 ELSE 0 END) as positive \
        FROM proposals \
        WHERE status != 'draft' \
        GROUP BY hook_strategy_id \
        ORDER BY positive * 1.0 / NULLIF(total, 0) DESC \
        LIMIT 1",
        [],
        |row| {
            let total: i64 = row.get(1)?;
            let positive: i64 = row.get(2)?;
            let rate = if total > 0 {
                (positive as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            Ok((Some(row.get::<_, String>(0)?), rate))
        },
    ).unwrap_or((None, 0.0));

    Ok(AnalyticsSummary {
        total_proposals,
        positive_outcomes,
        resolved_proposals,
        proposals_this_month,
        response_rate,
        best_strategy,
        best_strategy_rate,
    })
}

/// Get outcome distribution for bar chart (Story 7.5 AC-2).
/// Returns count of proposals per outcome status.
/// Filters: status != 'draft'.
pub fn get_outcome_distribution(conn: &Connection) -> Result<Vec<OutcomeCount>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT outcome_status, COUNT(*) as count \
        FROM proposals \
        WHERE status != 'draft' \
        GROUP BY outcome_status \
        ORDER BY count DESC",
    )?;

    let outcomes = stmt
        .query_map([], |row| {
            Ok(OutcomeCount {
                outcome_status: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(outcomes)
}

/// Get response rate by hook strategy (Story 7.5 AC-3).
/// Returns performance metrics per strategy, sorted by response rate descending.
/// Filters: status != 'draft'.
/// COALESCE(hook_strategy_id, 'none') handles NULL strategies.
pub fn get_response_rate_by_strategy(
    conn: &Connection,
) -> Result<Vec<StrategyPerformance>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT \
            COALESCE(hook_strategy_id, 'none') as strategy, \
            COUNT(*) as total, \
            SUM(CASE WHEN outcome_status IN ('response_received','interview','hired') THEN 1 ELSE 0 END) as positive \
        FROM proposals \
        WHERE status != 'draft' \
        GROUP BY hook_strategy_id \
        ORDER BY positive * 1.0 / NULLIF(total, 0) DESC"
    )?;

    let strategies = stmt
        .query_map([], |row| {
            let total: i64 = row.get(1)?;
            let positive: i64 = row.get(2)?;
            let response_rate = if total > 0 {
                (positive as f64 / total as f64) * 100.0
            } else {
                0.0
            };

            Ok(StrategyPerformance {
                strategy: row.get(0)?,
                total,
                positive,
                response_rate,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(strategies)
}

/// Get weekly proposal activity (Story 7.5 AC-4).
/// Returns proposal count and response rate per week for the last N weeks.
/// Filters: status != 'draft'.
/// weeks: number of weeks to look back (default 12).
pub fn get_weekly_activity(
    conn: &Connection,
    weeks: u32,
) -> Result<Vec<WeeklyActivity>, rusqlite::Error> {
    let days = weeks * 7;
    let mut stmt = conn.prepare(
        "SELECT \
            strftime('%Y-W%W', created_at) as week_label, \
            DATE(created_at, 'weekday 0', '-6 days') as week_start, \
            COUNT(*) as proposal_count, \
            SUM(CASE WHEN outcome_status IN ('response_received','interview','hired') THEN 1 ELSE 0 END) as positive_count, \
            SUM(CASE WHEN outcome_status NOT IN ('pending','submitted') THEN 1 ELSE 0 END) as resolved_count \
        FROM proposals \
        WHERE status != 'draft' \
            AND created_at >= datetime('now', '-' || ?1 || ' days') \
        GROUP BY week_label \
        ORDER BY week_start ASC"
    )?;

    let activities = stmt
        .query_map(params![days], |row| {
            let proposal_count: i64 = row.get(2)?;
            let positive_count: i64 = row.get(3)?;
            let resolved_count: i64 = row.get(4)?;
            // CR R2 H-1: Use resolved_count (excluding pending/submitted) as denominator
            // for consistency with get_proposal_analytics_summary response rate formula
            let response_rate = if resolved_count > 0 {
                (positive_count as f64 / resolved_count as f64) * 100.0
            } else {
                0.0
            };

            Ok(WeeklyActivity {
                week_label: row.get(0)?,
                week_start: row.get(1)?,
                proposal_count,
                positive_count,
                response_rate,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(activities)
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

        insert_proposal(
            &conn,
            "Job",
            "Long generated text that should not be in summary",
            None,
        )
        .unwrap();

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
            insert_proposal(
                &conn,
                &format!("Job {}", i),
                &format!("Proposal {}", i),
                None,
            )
            .unwrap();
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
            insert_proposal(
                &conn,
                &format!("Job {}", i),
                &format!("Proposal {}", i),
                None,
            )
            .unwrap();
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

    // =========================================================================
    // Story 7.1: Migration V27 — Outcome Tracking Columns
    // =========================================================================

    #[test]
    fn test_v27_outcome_status_column_exists_with_default() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert a proposal (no outcome_status specified — should get default 'pending')
        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        // Query the new column directly
        let outcome_status: String = conn
            .query_row(
                "SELECT outcome_status FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(
            outcome_status, "pending",
            "AC-6: default outcome_status should be 'pending'"
        );
    }

    #[test]
    fn test_v27_outcome_updated_at_column_exists_nullable() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        // outcome_updated_at should be NULL for new proposals
        let outcome_updated_at: Option<String> = conn
            .query_row(
                "SELECT outcome_updated_at FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert!(
            outcome_updated_at.is_none(),
            "AC-1: outcome_updated_at should be NULL by default"
        );
    }

    #[test]
    fn test_v27_hook_strategy_id_column_exists_nullable() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        // hook_strategy_id should be NULL for new proposals
        let hook_strategy_id: Option<String> = conn
            .query_row(
                "SELECT hook_strategy_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert!(
            hook_strategy_id.is_none(),
            "AC-1: hook_strategy_id should be NULL by default"
        );
    }

    #[test]
    fn test_v27_job_post_id_column_exists_nullable() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        // job_post_id should be NULL for new proposals
        let job_post_id: Option<i64> = conn
            .query_row(
                "SELECT job_post_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();

        assert!(
            job_post_id.is_none(),
            "AC-1: job_post_id should be NULL by default"
        );
    }

    // =========================================================================
    // Story 7.1 Task 2: insert_proposal_with_context tests
    // =========================================================================

    #[test]
    fn test_insert_proposal_with_hook_strategy_and_job_post() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert a job post first (for FK reference)
        conn.execute(
            "INSERT INTO job_posts (raw_content) VALUES (?1)",
            params!["Test job post content"],
        )
        .unwrap();
        let job_post_id: i64 = conn
            .query_row(
                "SELECT id FROM job_posts ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        // AC-2: Insert proposal with hook strategy key
        // AC-3: Insert proposal with job_post_id FK
        let id = insert_proposal_with_context(
            &conn,
            "Test job",
            "Test proposal text",
            None,
            Some("social_proof"),
            Some(job_post_id),
        )
        .unwrap();

        // Verify hook_strategy_id stored
        let hook_strategy: Option<String> = conn
            .query_row(
                "SELECT hook_strategy_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            hook_strategy.as_deref(),
            Some("social_proof"),
            "AC-2: hook_strategy_id should store the strategy key"
        );

        // Verify job_post_id stored
        let stored_job_post_id: Option<i64> = conn
            .query_row(
                "SELECT job_post_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            stored_job_post_id,
            Some(job_post_id),
            "AC-3: job_post_id should store the FK reference"
        );
    }

    #[test]
    fn test_insert_proposal_with_context_null_optionals() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert without strategy or job post
        let id =
            insert_proposal_with_context(&conn, "Test job", "Test text", None, None, None).unwrap();

        let hook_strategy: Option<String> = conn
            .query_row(
                "SELECT hook_strategy_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            hook_strategy.is_none(),
            "hook_strategy_id should be NULL when not provided"
        );

        let job_post_id: Option<i64> = conn
            .query_row(
                "SELECT job_post_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            job_post_id.is_none(),
            "job_post_id should be NULL when not provided"
        );
    }

    #[test]
    fn test_insert_proposal_backward_compatible() {
        // Verify the original insert_proposal still works
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id =
            insert_proposal(&conn, "Backward compat job", "Backward compat text", None).unwrap();

        // Should have default values for new columns
        let outcome_status: String = conn
            .query_row(
                "SELECT outcome_status FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(outcome_status, "pending");

        let hook_strategy: Option<String> = conn
            .query_row(
                "SELECT hook_strategy_id FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(hook_strategy.is_none());
    }

    #[test]
    fn test_v27_indexes_exist() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Verify indexes were created by querying sqlite_master
        let index_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN (
                    'idx_proposals_outcome_status',
                    'idx_proposals_hook_strategy',
                    'idx_proposals_job_post_id'
                )",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(index_count, 3, "AC-1: All 3 V27 indexes should exist");
    }

    // =========================================================================
    // Story 7.1 Task 3: update_proposal_outcome tests
    // =========================================================================

    #[test]
    fn test_update_proposal_outcome_valid() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        // AC-5: Update outcome to 'submitted'
        let updated = update_proposal_outcome(&conn, id, "submitted").unwrap();
        assert!(updated, "Should return true when proposal exists");

        // Verify outcome_status updated
        let outcome: String = conn
            .query_row(
                "SELECT outcome_status FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(outcome, "submitted");

        // Verify outcome_updated_at is set
        let updated_at: Option<String> = conn
            .query_row(
                "SELECT outcome_updated_at FROM proposals WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            updated_at.is_some(),
            "outcome_updated_at should be set after update"
        );
    }

    #[test]
    fn test_update_proposal_outcome_all_valid_statuses() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let valid_statuses = [
            "pending",
            "submitted",
            "response_received",
            "interview",
            "hired",
            "no_response",
            "rejected",
        ];

        for status in &valid_statuses {
            let id = insert_proposal(&conn, "Job", "Text", None).unwrap();
            let result = update_proposal_outcome(&conn, id, status);
            assert!(result.is_ok(), "Status '{}' should be valid", status);
            assert!(result.unwrap(), "Should update for status '{}'", status);
        }
    }

    #[test]
    fn test_update_proposal_outcome_invalid_status() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Test job", "Test text", None).unwrap();

        // Invalid status should return error
        let result = update_proposal_outcome(&conn, id, "invalid_status");
        assert!(result.is_err(), "Invalid status should return error");
        let err = result.unwrap_err();
        assert!(
            err.contains("Invalid outcome_status"),
            "Error should mention invalid status: {}",
            err
        );
    }

    #[test]
    fn test_update_proposal_outcome_nonexistent_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Valid status but non-existent proposal
        let updated = update_proposal_outcome(&conn, 99999, "submitted").unwrap();
        assert!(!updated, "Should return false for non-existent proposal");
    }

    #[test]
    fn test_delete_proposal_cascades_to_revisions() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Create a proposal
        let proposal_id =
            insert_proposal(&conn, "Job with revisions", "Original text", None).unwrap();

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
        let revision_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = ?1",
                params![proposal_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(revision_count, 2, "Should have 2 revisions before delete");

        // Delete the proposal
        let deleted = delete_proposal(&conn, proposal_id).unwrap();
        assert!(deleted);

        // Verify revisions are CASCADE deleted
        let revision_count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = ?1",
                params![proposal_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            revision_count_after, 0,
            "Revisions should be CASCADE deleted"
        );
    }

    // =========================================================================
    // Story 7.3: search_proposals tests
    // =========================================================================

    #[test]
    fn test_search_proposals_no_filters() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job A", "Proposal A", None).unwrap();
        insert_proposal(&conn, "Job B", "Proposal B", None).unwrap();

        let result = search_proposals(&conn, None, None, None, None, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 2);
        assert_eq!(result.total_count, 2);
        assert!(!result.has_more);
    }

    #[test]
    fn test_search_proposals_text_search_job_content() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Looking for a React developer", "I am excited", None).unwrap();
        insert_proposal(&conn, "Need Python developer", "I have 5 years", None).unwrap();
        insert_proposal(&conn, "Java backend role", "Spring boot", None).unwrap();

        let result = search_proposals(&conn, Some("React"), None, None, None, 50, 0).unwrap();

        assert_eq!(result.total_count, 1);
        assert_eq!(result.proposals.len(), 1);
        assert!(result.proposals[0].job_excerpt.contains("React"));
    }

    #[test]
    fn test_search_proposals_text_search_generated_text() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(
            &conn,
            "Job A",
            "I have extensive experience with Rust",
            None,
        )
        .unwrap();
        insert_proposal(&conn, "Job B", "Python is my forte", None).unwrap();

        let result = search_proposals(&conn, Some("Rust"), None, None, None, 50, 0).unwrap();

        assert_eq!(result.total_count, 1);
        assert_eq!(result.proposals.len(), 1);
    }

    #[test]
    fn test_search_proposals_text_search_case_insensitive() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Looking for REACT developer", "Proposal", None).unwrap();

        let result = search_proposals(&conn, Some("react"), None, None, None, 50, 0).unwrap();

        assert_eq!(
            result.total_count, 1,
            "Text search should be case-insensitive"
        );
    }

    #[test]
    fn test_search_proposals_status_filter() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "Job A", "Text A", None).unwrap();
        let id2 = insert_proposal(&conn, "Job B", "Text B", None).unwrap();
        insert_proposal(&conn, "Job C", "Text C", None).unwrap();

        // Update outcomes
        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "rejected").unwrap();

        let result = search_proposals(&conn, None, Some("hired"), None, None, 50, 0).unwrap();

        assert_eq!(result.total_count, 1);
        assert_eq!(result.proposals[0].outcome_status, "hired");
    }

    #[test]
    fn test_search_proposals_date_range_filter() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert proposals — all have "now" timestamp, so they're within any date range
        insert_proposal(&conn, "Job A", "Text A", None).unwrap();

        let result = search_proposals(&conn, None, None, Some(7), None, 50, 0).unwrap();
        assert_eq!(
            result.total_count, 1,
            "Proposal created 'now' should be within 7 days"
        );

        let result_all = search_proposals(&conn, None, None, Some(0), None, 50, 0).unwrap();
        assert_eq!(
            result_all.total_count, 1,
            "date_range_days=0 means no date filter"
        );
    }

    #[test]
    fn test_search_proposals_hook_strategy_filter() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal_with_context(&conn, "Job A", "Text A", None, Some("social_proof"), None)
            .unwrap();
        insert_proposal_with_context(&conn, "Job B", "Text B", None, Some("contrarian"), None)
            .unwrap();
        insert_proposal(&conn, "Job C", "Text C", None).unwrap();

        let result =
            search_proposals(&conn, None, None, None, Some("social_proof"), 50, 0).unwrap();

        assert_eq!(result.total_count, 1);
        assert_eq!(
            result.proposals[0].hook_strategy_id.as_deref(),
            Some("social_proof")
        );
    }

    #[test]
    fn test_search_proposals_combined_filters() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal_with_context(
            &conn,
            "React developer needed",
            "I love React",
            None,
            Some("social_proof"),
            None,
        )
        .unwrap();
        insert_proposal_with_context(
            &conn,
            "React job",
            "React text",
            None,
            Some("contrarian"),
            None,
        )
        .unwrap();
        insert_proposal_with_context(
            &conn,
            "Python job",
            "Python text",
            None,
            Some("social_proof"),
            None,
        )
        .unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();

        // Search "React" + status "hired" + strategy "social_proof"
        let result = search_proposals(
            &conn,
            Some("React"),
            Some("hired"),
            None,
            Some("social_proof"),
            50,
            0,
        )
        .unwrap();

        assert_eq!(result.total_count, 1);
        assert_eq!(result.proposals[0].id, id1);
    }

    #[test]
    fn test_search_proposals_empty_results() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job A", "Text A", None).unwrap();

        let result =
            search_proposals(&conn, Some("nonexistent_xyz"), None, None, None, 50, 0).unwrap();

        assert_eq!(result.total_count, 0);
        assert_eq!(result.proposals.len(), 0);
        assert!(!result.has_more);
    }

    #[test]
    fn test_search_proposals_pagination() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        for i in 0..10 {
            insert_proposal(&conn, &format!("Job {}", i), &format!("Text {}", i), None).unwrap();
        }

        let page1 = search_proposals(&conn, None, None, None, None, 3, 0).unwrap();
        assert_eq!(page1.proposals.len(), 3);
        assert_eq!(page1.total_count, 10);
        assert!(page1.has_more);

        let page2 = search_proposals(&conn, None, None, None, None, 3, 9).unwrap();
        assert_eq!(page2.proposals.len(), 1);
        assert!(!page2.has_more);
    }

    #[test]
    fn test_search_proposals_returns_correct_shape() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let long_job = "X".repeat(500);
        let long_text = "Y".repeat(500);
        insert_proposal_with_context(
            &conn,
            &long_job,
            &long_text,
            None,
            Some("social_proof"),
            None,
        )
        .unwrap();

        let result = search_proposals(&conn, None, None, None, None, 50, 0).unwrap();

        assert_eq!(result.proposals.len(), 1);
        let p = &result.proposals[0];
        assert_eq!(
            p.job_excerpt.len(),
            100,
            "job_excerpt should be truncated to 100 chars"
        );
        assert_eq!(
            p.preview_text.len(),
            200,
            "preview_text should be truncated to 200 chars"
        );
        assert!(!p.created_at.is_empty());
        assert_eq!(p.outcome_status, "pending");
        assert_eq!(p.hook_strategy_id.as_deref(), Some("social_proof"));
    }

    #[test]
    fn test_search_proposals_empty_search_text_ignored() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job A", "Text A", None).unwrap();

        // Empty string should be treated as no filter
        let result = search_proposals(&conn, Some(""), None, None, None, 50, 0).unwrap();
        assert_eq!(result.total_count, 1);
    }

    #[test]
    fn test_search_proposals_escapes_like_wildcards() {
        // CR M-2: Ensure % and _ in search text are escaped, not treated as SQL wildcards
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Achieved 100% coverage", "Text A", None).unwrap();
        insert_proposal(&conn, "Achieved 100X coverage", "Text B", None).unwrap();
        insert_proposal(&conn, "Has data_field in code", "Text C", None).unwrap();
        insert_proposal(&conn, "Has dataXfield in code", "Text D", None).unwrap();

        // Searching "100%" should only match the literal "100%", not "100X"
        let result = search_proposals(&conn, Some("100%"), None, None, None, 50, 0).unwrap();
        assert_eq!(
            result.total_count, 1,
            "% should be escaped: only literal '100%' matches"
        );
        assert!(result.proposals[0].job_excerpt.contains("100%"));

        // Searching "data_field" should only match the literal "data_field", not "dataXfield"
        let result2 = search_proposals(&conn, Some("data_field"), None, None, None, 50, 0).unwrap();
        assert_eq!(
            result2.total_count, 1,
            "_ should be escaped: only literal 'data_field' matches"
        );
        assert!(result2.proposals[0].job_excerpt.contains("data_field"));
    }

    // =========================================================================
    // Story 7.3: get_distinct_hook_strategies tests
    // =========================================================================

    #[test]
    fn test_get_distinct_hook_strategies_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Job", "Text", None).unwrap();

        let strategies = get_distinct_hook_strategies(&conn).unwrap();
        assert!(strategies.is_empty());
    }

    #[test]
    fn test_get_distinct_hook_strategies_returns_unique() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal_with_context(&conn, "J1", "T1", None, Some("social_proof"), None).unwrap();
        insert_proposal_with_context(&conn, "J2", "T2", None, Some("social_proof"), None).unwrap();
        insert_proposal_with_context(&conn, "J3", "T3", None, Some("contrarian"), None).unwrap();
        insert_proposal(&conn, "J4", "T4", None).unwrap();

        let strategies = get_distinct_hook_strategies(&conn).unwrap();
        assert_eq!(strategies.len(), 2);
        assert!(strategies.contains(&"social_proof".to_string()));
        assert!(strategies.contains(&"contrarian".to_string()));
    }

    // =========================================================================
    // Story 7.4: get_proposal_detail tests
    // =========================================================================

    #[test]
    fn test_get_proposal_detail_found() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id =
            insert_proposal(&conn, "Job content here", "Generated proposal text", None).unwrap();

        let detail = get_proposal_detail(&conn, id).unwrap().unwrap();

        assert_eq!(detail.id, id);
        assert_eq!(detail.job_content, "Job content here");
        assert_eq!(detail.generated_text, "Generated proposal text");
        assert!(!detail.created_at.is_empty());
        assert_eq!(detail.status, "draft");
        assert_eq!(detail.outcome_status, "pending");
        assert!(detail.outcome_updated_at.is_none());
        assert!(detail.hook_strategy_id.is_none());
        assert!(detail.job_post_id.is_none());
        assert!(detail.job_title.is_none());
        assert_eq!(detail.revision_count, 0);
    }

    #[test]
    fn test_get_proposal_detail_not_found() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let detail = get_proposal_detail(&conn, 99999).unwrap();

        assert!(detail.is_none());
    }

    #[test]
    fn test_get_proposal_detail_with_revisions() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Job", "Text", None).unwrap();

        // Insert revisions
        conn.execute(
            "INSERT INTO proposal_revisions (proposal_id, content, revision_number) VALUES (?1, ?2, ?3)",
            params![id, "Rev 1", 1],
        ).unwrap();
        conn.execute(
            "INSERT INTO proposal_revisions (proposal_id, content, revision_number) VALUES (?1, ?2, ?3)",
            params![id, "Rev 2", 2],
        ).unwrap();
        conn.execute(
            "INSERT INTO proposal_revisions (proposal_id, content, revision_number) VALUES (?1, ?2, ?3)",
            params![id, "Rev 3", 3],
        ).unwrap();

        let detail = get_proposal_detail(&conn, id).unwrap().unwrap();

        assert_eq!(detail.revision_count, 3);
    }

    #[test]
    fn test_get_proposal_detail_with_job_post_link() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert a job post with client_name
        conn.execute(
            "INSERT INTO job_posts (raw_content, client_name) VALUES (?1, ?2)",
            params!["Full job content here", "Acme Corp"],
        )
        .unwrap();
        let job_post_id: i64 = conn
            .query_row(
                "SELECT id FROM job_posts ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        // Insert proposal linked to job post
        let id = insert_proposal_with_context(
            &conn,
            "Job",
            "Text",
            None,
            Some("social_proof"),
            Some(job_post_id),
        )
        .unwrap();

        let detail = get_proposal_detail(&conn, id).unwrap().unwrap();

        assert_eq!(detail.job_post_id, Some(job_post_id));
        assert_eq!(detail.job_title.as_deref(), Some("Acme Corp"));
        assert_eq!(detail.hook_strategy_id.as_deref(), Some("social_proof"));
    }

    #[test]
    fn test_get_proposal_detail_job_post_fallback_to_raw_content() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert a job post WITHOUT client_name — should fall back to SUBSTR(raw_content, 1, 80)
        conn.execute(
            "INSERT INTO job_posts (raw_content) VALUES (?1)",
            params!["Looking for a React developer with 5 years experience in building web applications and dashboards"],
        ).unwrap();
        let job_post_id: i64 = conn
            .query_row(
                "SELECT id FROM job_posts ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let id = insert_proposal_with_context(&conn, "Job", "Text", None, None, Some(job_post_id))
            .unwrap();

        let detail = get_proposal_detail(&conn, id).unwrap().unwrap();

        assert_eq!(detail.job_post_id, Some(job_post_id));
        // Should be first 80 chars of raw_content
        assert_eq!(
            detail.job_title.as_deref(),
            Some(
                "Looking for a React developer with 5 years experience in building web applicatio"
            )
        );
    }

    #[test]
    fn test_get_proposal_detail_without_optional_fields() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Proposal with no hook_strategy, no job_post, no revisions, no outcome update
        let id =
            insert_proposal(&conn, "Simple job", "Simple proposal", Some("completed")).unwrap();

        let detail = get_proposal_detail(&conn, id).unwrap().unwrap();

        assert_eq!(detail.status, "completed");
        assert_eq!(detail.outcome_status, "pending");
        assert!(detail.outcome_updated_at.is_none());
        assert!(detail.hook_strategy_id.is_none());
        assert!(detail.job_post_id.is_none());
        assert!(detail.job_title.is_none());
        assert_eq!(detail.revision_count, 0);
    }

    // =========================================================================
    // Story 7.5: Analytics Dashboard tests
    // =========================================================================

    #[test]
    fn test_get_proposal_analytics_summary_empty_db() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let summary = get_proposal_analytics_summary(&conn).unwrap();

        assert_eq!(summary.total_proposals, 0);
        assert_eq!(summary.positive_outcomes, 0);
        assert_eq!(summary.resolved_proposals, 0);
        assert_eq!(summary.proposals_this_month, 0);
        assert_eq!(summary.response_rate, 0.0);
        assert!(summary.best_strategy.is_none());
        assert_eq!(summary.best_strategy_rate, 0.0);
    }

    #[test]
    fn test_get_proposal_analytics_summary_single_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id = insert_proposal(&conn, "Job", "Text", Some("completed")).unwrap();
        update_proposal_outcome(&conn, id, "hired").unwrap();

        let summary = get_proposal_analytics_summary(&conn).unwrap();

        assert_eq!(summary.total_proposals, 1);
        assert_eq!(summary.positive_outcomes, 1);
        assert_eq!(summary.resolved_proposals, 1);
        assert_eq!(summary.proposals_this_month, 1);
        assert_eq!(summary.response_rate, 100.0);
    }

    #[test]
    fn test_get_proposal_analytics_summary_multiple_outcomes() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        // Create proposals with different outcomes
        let id1 = insert_proposal(&conn, "Job 1", "Text 1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Text 2", Some("completed")).unwrap();
        let id3 = insert_proposal(&conn, "Job 3", "Text 3", Some("completed")).unwrap();
        let id4 = insert_proposal(&conn, "Job 4", "Text 4", Some("completed")).unwrap();
        let id5 = insert_proposal(&conn, "Job 5", "Text 5", Some("completed")).unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "interview").unwrap();
        update_proposal_outcome(&conn, id3, "response_received").unwrap();
        update_proposal_outcome(&conn, id4, "no_response").unwrap();
        update_proposal_outcome(&conn, id5, "rejected").unwrap();

        let summary = get_proposal_analytics_summary(&conn).unwrap();

        assert_eq!(summary.total_proposals, 5);
        assert_eq!(summary.positive_outcomes, 3); // hired, interview, response_received
        assert_eq!(summary.resolved_proposals, 5); // all resolved
        assert_eq!(summary.response_rate, 60.0); // 3/5 * 100
    }

    #[test]
    fn test_get_proposal_analytics_summary_excludes_drafts() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Draft 1", "Text", Some("draft")).unwrap();
        let id = insert_proposal(&conn, "Completed", "Text", Some("completed")).unwrap();
        update_proposal_outcome(&conn, id, "hired").unwrap();

        let summary = get_proposal_analytics_summary(&conn).unwrap();

        assert_eq!(summary.total_proposals, 1); // draft excluded
    }

    #[test]
    fn test_get_proposal_analytics_summary_excludes_pending_from_resolved() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "Job 1", "Text 1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "Job 2", "Text 2", Some("completed")).unwrap();
        update_proposal_outcome(&conn, id1, "hired").unwrap();
        // id2 stays "pending" (default)

        let summary = get_proposal_analytics_summary(&conn).unwrap();

        assert_eq!(summary.total_proposals, 2);
        assert_eq!(summary.positive_outcomes, 1);
        assert_eq!(summary.resolved_proposals, 1); // pending excluded from resolved
        assert_eq!(summary.response_rate, 100.0); // 1/1 * 100
    }

    #[test]
    fn test_get_proposal_analytics_summary_best_strategy() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal_with_context(
            &conn,
            "J1",
            "T1",
            Some("completed"),
            Some("social_proof"),
            None,
        )
        .unwrap();
        let id2 = insert_proposal_with_context(
            &conn,
            "J2",
            "T2",
            Some("completed"),
            Some("social_proof"),
            None,
        )
        .unwrap();
        let id3 = insert_proposal_with_context(
            &conn,
            "J3",
            "T3",
            Some("completed"),
            Some("contrarian"),
            None,
        )
        .unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "hired").unwrap();
        update_proposal_outcome(&conn, id3, "no_response").unwrap();

        let summary = get_proposal_analytics_summary(&conn).unwrap();

        assert_eq!(summary.best_strategy.as_deref(), Some("social_proof"));
        assert_eq!(summary.best_strategy_rate, 100.0); // 2/2
    }

    #[test]
    fn test_get_outcome_distribution_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let outcomes = get_outcome_distribution(&conn).unwrap();
        assert!(outcomes.is_empty());
    }

    #[test]
    fn test_get_outcome_distribution_multiple_statuses() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "J1", "T1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "J2", "T2", Some("completed")).unwrap();
        let id3 = insert_proposal(&conn, "J3", "T3", Some("completed")).unwrap();
        let id4 = insert_proposal(&conn, "J4", "T4", Some("completed")).unwrap();
        let id5 = insert_proposal(&conn, "J5", "T5", Some("completed")).unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "hired").unwrap();
        update_proposal_outcome(&conn, id3, "interview").unwrap();
        update_proposal_outcome(&conn, id4, "rejected").unwrap();
        // id5 stays pending

        let outcomes = get_outcome_distribution(&conn).unwrap();

        assert_eq!(outcomes.len(), 4);
        // First entry should be most common (hired: 2)
        assert_eq!(outcomes[0].outcome_status, "hired");
        assert_eq!(outcomes[0].count, 2);
        // Find pending
        let pending = outcomes
            .iter()
            .find(|o| o.outcome_status == "pending")
            .unwrap();
        assert_eq!(pending.count, 1);
    }

    #[test]
    fn test_get_outcome_distribution_excludes_drafts() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Draft", "Text", Some("draft")).unwrap();
        insert_proposal(&conn, "Complete", "Text", Some("completed")).unwrap();

        let outcomes = get_outcome_distribution(&conn).unwrap();

        assert_eq!(outcomes.len(), 1);
        assert_eq!(outcomes[0].outcome_status, "pending");
        assert_eq!(outcomes[0].count, 1);
    }

    #[test]
    fn test_get_response_rate_by_strategy_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let strategies = get_response_rate_by_strategy(&conn).unwrap();
        assert!(strategies.is_empty());
    }

    #[test]
    fn test_get_response_rate_by_strategy_multiple_strategies() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal_with_context(
            &conn,
            "J1",
            "T1",
            Some("completed"),
            Some("social_proof"),
            None,
        )
        .unwrap();
        let id2 = insert_proposal_with_context(
            &conn,
            "J2",
            "T2",
            Some("completed"),
            Some("social_proof"),
            None,
        )
        .unwrap();
        let id3 = insert_proposal_with_context(
            &conn,
            "J3",
            "T3",
            Some("completed"),
            Some("contrarian"),
            None,
        )
        .unwrap();
        let id4 = insert_proposal_with_context(
            &conn,
            "J4",
            "T4",
            Some("completed"),
            Some("contrarian"),
            None,
        )
        .unwrap();
        let id5 = insert_proposal_with_context(
            &conn,
            "J5",
            "T5",
            Some("completed"),
            Some("contrarian"),
            None,
        )
        .unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "hired").unwrap();
        update_proposal_outcome(&conn, id3, "hired").unwrap();
        update_proposal_outcome(&conn, id4, "no_response").unwrap();
        update_proposal_outcome(&conn, id5, "rejected").unwrap();

        let strategies = get_response_rate_by_strategy(&conn).unwrap();

        assert_eq!(strategies.len(), 2);
        // Sorted by response rate descending: social_proof 100%, contrarian 33.3%
        assert_eq!(strategies[0].strategy, "social_proof");
        assert_eq!(strategies[0].total, 2);
        assert_eq!(strategies[0].positive, 2);
        assert_eq!(strategies[0].response_rate, 100.0);

        assert_eq!(strategies[1].strategy, "contrarian");
        assert_eq!(strategies[1].total, 3);
        assert_eq!(strategies[1].positive, 1);
        assert!((strategies[1].response_rate - 33.333).abs() < 0.01);
    }

    #[test]
    fn test_get_response_rate_by_strategy_none_strategy() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "J1", "T1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "J2", "T2", Some("completed")).unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "no_response").unwrap();

        let strategies = get_response_rate_by_strategy(&conn).unwrap();

        assert_eq!(strategies.len(), 1);
        assert_eq!(strategies[0].strategy, "none");
        assert_eq!(strategies[0].total, 2);
        assert_eq!(strategies[0].positive, 1);
        assert_eq!(strategies[0].response_rate, 50.0);
    }

    #[test]
    fn test_get_response_rate_by_strategy_excludes_drafts() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal_with_context(
            &conn,
            "Draft",
            "Text",
            Some("draft"),
            Some("social_proof"),
            None,
        )
        .unwrap();
        let id = insert_proposal_with_context(
            &conn,
            "Complete",
            "Text",
            Some("completed"),
            Some("social_proof"),
            None,
        )
        .unwrap();
        update_proposal_outcome(&conn, id, "hired").unwrap();

        let strategies = get_response_rate_by_strategy(&conn).unwrap();

        assert_eq!(strategies.len(), 1);
        assert_eq!(strategies[0].total, 1); // draft excluded
    }

    #[test]
    fn test_get_weekly_activity_empty() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let activities = get_weekly_activity(&conn, 12).unwrap();
        assert!(activities.is_empty());
    }

    #[test]
    fn test_get_weekly_activity_single_week() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "J1", "T1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "J2", "T2", Some("completed")).unwrap();

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "no_response").unwrap();

        let activities = get_weekly_activity(&conn, 12).unwrap();

        assert_eq!(activities.len(), 1);
        assert_eq!(activities[0].proposal_count, 2);
        assert_eq!(activities[0].positive_count, 1);
        assert_eq!(activities[0].response_rate, 50.0);
        assert!(!activities[0].week_label.is_empty());
        assert!(!activities[0].week_start.is_empty());
    }

    #[test]
    fn test_get_weekly_activity_excludes_drafts() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Draft", "Text", Some("draft")).unwrap();
        insert_proposal(&conn, "Complete", "Text", Some("completed")).unwrap();

        let activities = get_weekly_activity(&conn, 12).unwrap();

        assert_eq!(activities.len(), 1);
        assert_eq!(activities[0].proposal_count, 1); // draft excluded
    }

    // CR R2 H-1: Verify response rate uses resolved_count denominator (excludes pending/submitted)
    #[test]
    fn test_get_weekly_activity_rate_excludes_pending() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let id1 = insert_proposal(&conn, "J1", "T1", Some("completed")).unwrap();
        let id2 = insert_proposal(&conn, "J2", "T2", Some("completed")).unwrap();
        let _id3 = insert_proposal(&conn, "J3", "T3", Some("completed")).unwrap(); // stays pending

        update_proposal_outcome(&conn, id1, "hired").unwrap();
        update_proposal_outcome(&conn, id2, "no_response").unwrap();
        // id3 has no outcome update → outcome_status stays 'pending'

        let activities = get_weekly_activity(&conn, 12).unwrap();

        assert_eq!(activities.len(), 1);
        assert_eq!(activities[0].proposal_count, 3); // all 3 counted
        assert_eq!(activities[0].positive_count, 1); // only hired
                                                     // Rate = 1/2 * 100 = 50.0 (denominator is 2 resolved, not 3 total)
        assert_eq!(activities[0].response_rate, 50.0);
    }

    #[test]
    fn test_get_weekly_activity_weeks_parameter() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        insert_proposal(&conn, "Recent", "Text", Some("completed")).unwrap();

        // Query last 1 week (7 days) - should include recent proposal
        let activities_1w = get_weekly_activity(&conn, 1).unwrap();
        assert_eq!(activities_1w.len(), 1);

        // Query last 52 weeks - should also include it
        let activities_52w = get_weekly_activity(&conn, 52).unwrap();
        assert_eq!(activities_52w.len(), 1);
    }
}
