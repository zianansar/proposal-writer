//! Safety overrides database queries.
//!
//! Story 3.7: Adaptive Threshold Learning from Overrides
//! Provides CRUD operations for the safety_overrides table.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Override status values
pub const STATUS_PENDING: &str = "pending";
pub const STATUS_SUCCESSFUL: &str = "successful";
pub const STATUS_UNSUCCESSFUL: &str = "unsuccessful";

/// A safety override record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetyOverride {
    pub id: i64,
    pub proposal_id: i64,
    pub timestamp: String,
    pub ai_score: f32,
    pub threshold_at_override: f32,
    pub status: String,
    pub user_feedback: Option<String>,
}

/// Threshold adjustment suggestion from learning algorithm.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdSuggestion {
    pub current_threshold: i32,
    pub suggested_threshold: i32,
    pub successful_override_count: usize,
    pub average_override_score: f32,
    pub direction: String, // "increase" | "decrease"
}

/// Record a new safety override event (Task 2.1).
///
/// Called when user clicks "I Understand the Risks, Proceed Anyway" (Story 3.6).
/// Creates a record with status "pending" for later success confirmation.
///
/// # Arguments
/// * `conn` - Database connection
/// * `proposal_id` - ID of the proposal being overridden
/// * `ai_score` - AI detection score that triggered the warning
/// * `threshold` - Safety threshold at time of override
///
/// # Returns
/// The ID of the newly created override record
pub fn record_override(
    conn: &Connection,
    proposal_id: i64,
    ai_score: f32,
    threshold: f32,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO safety_overrides (proposal_id, ai_score, threshold_at_override, status)
         VALUES (?1, ?2, ?3, 'pending')",
        params![proposal_id, ai_score, threshold],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Update the status of an override record (Task 3.1, Task 3.3).
///
/// Used to mark overrides as successful/unsuccessful based on:
/// - Auto-confirm after 7 days (status = "successful")
/// - User explicit feedback (status = "successful")
/// - Proposal deleted (status = "unsuccessful")
///
/// # Arguments
/// * `conn` - Database connection
/// * `override_id` - ID of the override to update
/// * `status` - New status ("successful" or "unsuccessful")
pub fn update_override_status(
    conn: &Connection,
    override_id: i64,
    status: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE safety_overrides SET status = ?1 WHERE id = ?2",
        params![status, override_id],
    )?;
    Ok(())
}

/// Update status with optional user feedback.
pub fn update_override_status_with_feedback(
    conn: &Connection,
    override_id: i64,
    status: &str,
    feedback: Option<&str>,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE safety_overrides SET status = ?1, user_feedback = ?2 WHERE id = ?3",
        params![status, feedback, override_id],
    )?;
    Ok(())
}

/// Get successful overrides from the last 30 days (Task 4.1).
///
/// Used by learning detection algorithm to count successful overrides
/// within the threshold proximity window.
///
/// # Returns
/// List of successful overrides in the last 30 days, ordered by timestamp DESC
pub fn get_successful_overrides_last_30_days(
    conn: &Connection,
) -> Result<Vec<SafetyOverride>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, proposal_id, timestamp, ai_score, threshold_at_override, status, user_feedback
         FROM safety_overrides
         WHERE status = 'successful'
           AND timestamp >= datetime('now', '-30 days')
         ORDER BY timestamp DESC",
    )?;

    let overrides = stmt
        .query_map([], |row| {
            Ok(SafetyOverride {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                timestamp: row.get(2)?,
                ai_score: row.get(3)?,
                threshold_at_override: row.get(4)?,
                status: row.get(5)?,
                user_feedback: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(overrides)
}

/// Count pending overrides (Task 3.1).
///
/// Used to check if there are overrides awaiting success confirmation.
pub fn count_pending_overrides(conn: &Connection) -> Result<usize, rusqlite::Error> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM safety_overrides WHERE status = 'pending'",
        [],
        |row| row.get(0),
    )?;
    Ok(count as usize)
}

/// Get pending overrides older than 7 days for auto-confirmation (Task 3.1).
///
/// Called on app startup to auto-confirm overrides where 7 days have passed
/// without the proposal being deleted.
///
/// # Returns
/// List of pending overrides older than 7 days
pub fn get_pending_overrides_older_than_7_days(
    conn: &Connection,
) -> Result<Vec<SafetyOverride>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT so.id, so.proposal_id, so.timestamp, so.ai_score, so.threshold_at_override, so.status, so.user_feedback
         FROM safety_overrides so
         WHERE so.status = 'pending'
           AND so.timestamp <= datetime('now', '-7 days')",
    )?;

    let overrides = stmt
        .query_map([], |row| {
            Ok(SafetyOverride {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                timestamp: row.get(2)?,
                ai_score: row.get(3)?,
                threshold_at_override: row.get(4)?,
                status: row.get(5)?,
                user_feedback: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(overrides)
}

/// Check if a proposal exists (for success confirmation).
pub fn proposal_exists(conn: &Connection, proposal_id: i64) -> Result<bool, rusqlite::Error> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM proposals WHERE id = ?1",
        params![proposal_id],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Mark all pending overrides for a proposal as unsuccessful (Task 3.3).
///
/// Called when a proposal is deleted to mark related overrides as unsuccessful.
pub fn mark_proposal_overrides_unsuccessful(
    conn: &Connection,
    proposal_id: i64,
) -> Result<usize, rusqlite::Error> {
    let rows = conn.execute(
        "UPDATE safety_overrides SET status = 'unsuccessful' WHERE proposal_id = ?1 AND status = 'pending'",
        params![proposal_id],
    )?;
    Ok(rows)
}

/// Get overrides in the last 60 days (for downward adjustment detection).
///
/// Used to check if user has not overridden any warnings recently,
/// suggesting their threshold could be lowered.
pub fn count_overrides_last_60_days(conn: &Connection) -> Result<usize, rusqlite::Error> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM safety_overrides WHERE timestamp >= datetime('now', '-60 days')",
        [],
        |row| row.get(0),
    )?;
    Ok(count as usize)
}

/// Get all overrides for history view (Task 8.1).
///
/// Returns all overrides with optional filtering.
pub fn get_all_overrides(conn: &Connection) -> Result<Vec<SafetyOverride>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, proposal_id, timestamp, ai_score, threshold_at_override, status, user_feedback
         FROM safety_overrides
         ORDER BY timestamp DESC",
    )?;

    let overrides = stmt
        .query_map([], |row| {
            Ok(SafetyOverride {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                timestamp: row.get(2)?,
                ai_score: row.get(3)?,
                threshold_at_override: row.get(4)?,
                status: row.get(5)?,
                user_feedback: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(overrides)
}

/// Get overrides filtered by status (Task 8.1).
pub fn get_overrides_by_status(
    conn: &Connection,
    status: &str,
) -> Result<Vec<SafetyOverride>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, proposal_id, timestamp, ai_score, threshold_at_override, status, user_feedback
         FROM safety_overrides
         WHERE status = ?1
         ORDER BY timestamp DESC",
    )?;

    let overrides = stmt
        .query_map(params![status], |row| {
            Ok(SafetyOverride {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                timestamp: row.get(2)?,
                ai_score: row.get(3)?,
                threshold_at_override: row.get(4)?,
                status: row.get(5)?,
                user_feedback: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(overrides)
}

/// Get a single override by ID.
pub fn get_override(
    conn: &Connection,
    override_id: i64,
) -> Result<Option<SafetyOverride>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, proposal_id, timestamp, ai_score, threshold_at_override, status, user_feedback
         FROM safety_overrides
         WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![override_id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(SafetyOverride {
            id: row.get(0)?,
            proposal_id: row.get(1)?,
            timestamp: row.get(2)?,
            ai_score: row.get(3)?,
            threshold_at_override: row.get(4)?,
            status: row.get(5)?,
            user_feedback: row.get(6)?,
        }))
    } else {
        Ok(None)
    }
}

/// Get pending overrides for a specific proposal.
pub fn get_pending_overrides_for_proposal(
    conn: &Connection,
    proposal_id: i64,
) -> Result<Vec<SafetyOverride>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, proposal_id, timestamp, ai_score, threshold_at_override, status, user_feedback
         FROM safety_overrides
         WHERE proposal_id = ?1 AND status = 'pending'
         ORDER BY timestamp DESC",
    )?;

    let overrides = stmt
        .query_map(params![proposal_id], |row| {
            Ok(SafetyOverride {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                timestamp: row.get(2)?,
                ai_score: row.get(3)?,
                threshold_at_override: row.get(4)?,
                status: row.get(5)?,
                user_feedback: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(overrides)
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

    fn insert_test_proposal(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO proposals (job_content, generated_text, status) VALUES ('job', 'proposal', 'completed')",
            [],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    // Task 9.1: Test record_override creates database entry
    #[test]
    fn test_record_override_creates_entry() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);
        let override_id = record_override(&conn, proposal_id, 195.5, 180.0).unwrap();

        assert!(override_id > 0);

        let override_record = get_override(&conn, override_id).unwrap().unwrap();
        assert_eq!(override_record.proposal_id, proposal_id);
        assert_eq!(override_record.ai_score, 195.5);
        assert_eq!(override_record.threshold_at_override, 180.0);
        assert_eq!(override_record.status, STATUS_PENDING);
    }

    // Task 9.1: Test update_override_status modifies status
    #[test]
    fn test_update_override_status() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);
        let override_id = record_override(&conn, proposal_id, 195.5, 180.0).unwrap();

        // Update to successful
        update_override_status(&conn, override_id, STATUS_SUCCESSFUL).unwrap();

        let override_record = get_override(&conn, override_id).unwrap().unwrap();
        assert_eq!(override_record.status, STATUS_SUCCESSFUL);
    }

    // Task 9.1: Test get_successful_overrides_last_30_days filters correctly
    #[test]
    fn test_get_successful_overrides_last_30_days() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        // Create 3 overrides
        let id1 = record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        let id2 = record_override(&conn, proposal_id, 190.0, 180.0).unwrap();
        let _id3 = record_override(&conn, proposal_id, 195.0, 180.0).unwrap();

        // Mark 2 as successful, 1 as pending
        update_override_status(&conn, id1, STATUS_SUCCESSFUL).unwrap();
        update_override_status(&conn, id2, STATUS_SUCCESSFUL).unwrap();
        // _id3 stays pending

        let successful = get_successful_overrides_last_30_days(&conn).unwrap();
        assert_eq!(successful.len(), 2);
    }

    // Task 9.2: Test detection with exactly 3 overrides
    #[test]
    fn test_count_pending_overrides() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        // Create 3 pending overrides
        record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        record_override(&conn, proposal_id, 190.0, 180.0).unwrap();
        record_override(&conn, proposal_id, 195.0, 180.0).unwrap();

        let pending = count_pending_overrides(&conn).unwrap();
        assert_eq!(pending, 3);
    }

    // Task 9.2: Test detection with 2 overrides (no suggestion)
    #[test]
    fn test_successful_overrides_with_two() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        // Create 2 successful overrides
        let id1 = record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        let id2 = record_override(&conn, proposal_id, 190.0, 180.0).unwrap();
        update_override_status(&conn, id1, STATUS_SUCCESSFUL).unwrap();
        update_override_status(&conn, id2, STATUS_SUCCESSFUL).unwrap();

        let successful = get_successful_overrides_last_30_days(&conn).unwrap();
        assert_eq!(successful.len(), 2);
    }

    // Test mark_proposal_overrides_unsuccessful
    #[test]
    fn test_mark_proposal_overrides_unsuccessful() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        // Create 2 pending overrides
        let id1 = record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        let id2 = record_override(&conn, proposal_id, 190.0, 180.0).unwrap();

        // Mark all as unsuccessful (simulating proposal deletion)
        let count = mark_proposal_overrides_unsuccessful(&conn, proposal_id).unwrap();
        assert_eq!(count, 2);

        // Verify both are unsuccessful
        let o1 = get_override(&conn, id1).unwrap().unwrap();
        let o2 = get_override(&conn, id2).unwrap().unwrap();
        assert_eq!(o1.status, STATUS_UNSUCCESSFUL);
        assert_eq!(o2.status, STATUS_UNSUCCESSFUL);
    }

    // Test get_all_overrides
    #[test]
    fn test_get_all_overrides() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        record_override(&conn, proposal_id, 190.0, 180.0).unwrap();

        let all = get_all_overrides(&conn).unwrap();
        assert_eq!(all.len(), 2);
    }

    // Test get_overrides_by_status
    #[test]
    fn test_get_overrides_by_status() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        let id1 = record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        let _id2 = record_override(&conn, proposal_id, 190.0, 180.0).unwrap();
        update_override_status(&conn, id1, STATUS_SUCCESSFUL).unwrap();

        let successful = get_overrides_by_status(&conn, STATUS_SUCCESSFUL).unwrap();
        let pending = get_overrides_by_status(&conn, STATUS_PENDING).unwrap();

        assert_eq!(successful.len(), 1);
        assert_eq!(pending.len(), 1);
    }

    // Test proposal_exists
    #[test]
    fn test_proposal_exists() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        assert!(proposal_exists(&conn, proposal_id).unwrap());
        assert!(!proposal_exists(&conn, 99999).unwrap());
    }

    // Test count_overrides_last_60_days
    #[test]
    fn test_count_overrides_last_60_days() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        record_override(&conn, proposal_id, 190.0, 180.0).unwrap();

        let count = count_overrides_last_60_days(&conn).unwrap();
        assert_eq!(count, 2);
    }

    // Test update_override_status_with_feedback
    #[test]
    fn test_update_override_status_with_feedback() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);
        let override_id = record_override(&conn, proposal_id, 195.5, 180.0).unwrap();

        update_override_status_with_feedback(
            &conn,
            override_id,
            STATUS_SUCCESSFUL,
            Some("User confirmed success"),
        )
        .unwrap();

        let override_record = get_override(&conn, override_id).unwrap().unwrap();
        assert_eq!(override_record.status, STATUS_SUCCESSFUL);
        assert_eq!(
            override_record.user_feedback,
            Some("User confirmed success".to_string())
        );
    }

    // Test get_pending_overrides_for_proposal
    #[test]
    fn test_get_pending_overrides_for_proposal() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);

        record_override(&conn, proposal_id, 185.0, 180.0).unwrap();
        let id2 = record_override(&conn, proposal_id, 190.0, 180.0).unwrap();
        update_override_status(&conn, id2, STATUS_SUCCESSFUL).unwrap();

        let pending = get_pending_overrides_for_proposal(&conn, proposal_id).unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].ai_score, 185.0);
    }

    // Task 9.1 (Code Review Fix M3): Test 10-point proximity filtering for learning algorithm
    // Validates that overrides outside the ±10 point threshold proximity are not counted
    #[test]
    fn test_proximity_filtering_for_learning() {
        let db = create_test_db();
        let conn = db.conn.lock().unwrap();

        let proposal_id = insert_test_proposal(&conn);
        let current_threshold: f32 = 180.0;
        let proximity: f32 = 10.0;

        // Create overrides at various distances from threshold
        // Within proximity (should count): 175, 185, 180
        let id1 = record_override(&conn, proposal_id, 175.0, current_threshold).unwrap(); // -5, within
        let id2 = record_override(&conn, proposal_id, 185.0, current_threshold).unwrap(); // +5, within
        let id3 = record_override(&conn, proposal_id, 180.0, current_threshold).unwrap(); // 0, within

        // Outside proximity (should NOT count): 165, 195, 250
        let id4 = record_override(&conn, proposal_id, 165.0, current_threshold).unwrap(); // -15, outside
        let id5 = record_override(&conn, proposal_id, 195.0, current_threshold).unwrap(); // +15, outside
        let id6 = record_override(&conn, proposal_id, 250.0, current_threshold).unwrap(); // +70, outlier

        // Mark all as successful
        for id in [id1, id2, id3, id4, id5, id6] {
            update_override_status(&conn, id, STATUS_SUCCESSFUL).unwrap();
        }

        // Get successful overrides and filter by proximity (simulating learning algorithm)
        let successful = get_successful_overrides_last_30_days(&conn).unwrap();
        let nearby: Vec<_> = successful
            .iter()
            .filter(|o| {
                let score_diff = (o.ai_score - current_threshold).abs();
                score_diff <= proximity
            })
            .collect();

        // Should only count 3 overrides within ±10 points
        assert_eq!(nearby.len(), 3, "Only overrides within ±10 points should be counted");

        // Verify the nearby overrides are the correct ones
        let nearby_scores: Vec<f32> = nearby.iter().map(|o| o.ai_score).collect();
        assert!(nearby_scores.contains(&175.0));
        assert!(nearby_scores.contains(&185.0));
        assert!(nearby_scores.contains(&180.0));
        assert!(!nearby_scores.contains(&165.0));
        assert!(!nearby_scores.contains(&195.0));
        assert!(!nearby_scores.contains(&250.0));
    }
}
