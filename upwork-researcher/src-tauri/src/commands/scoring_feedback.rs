//! Scoring Feedback commands for Story 4b.10
//!
//! Provides Tauri commands for submitting and checking scoring feedback.

use crate::db::AppDatabase;
use crate::scoring::{
    CanReportResult, ScoringFeedbackIssue, ScoringFeedbackResult, SubmitScoringFeedbackInput,
};
use chrono::{Duration, Utc};
use rusqlite::{Connection, OptionalExtension};
use tauri::State;
use tracing::info;

/// Error types for scoring feedback operations
#[derive(Debug)]
pub enum FeedbackError {
    DatabaseError(String),
    DuplicateFeedback(String),
    ValidationError(String),
}

impl std::fmt::Display for FeedbackError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FeedbackError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            FeedbackError::DuplicateFeedback(msg) => write!(f, "{}", msg),
            FeedbackError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl From<FeedbackError> for String {
    fn from(err: FeedbackError) -> String {
        err.to_string()
    }
}

/// Internal function to check if user can report score (testable without Tauri State)
fn check_can_report_internal(
    conn: &Connection,
    job_post_id: i64,
) -> Result<CanReportResult, FeedbackError> {
    // Calculate 24-hour cutoff
    let cutoff = Utc::now() - Duration::hours(24);
    let cutoff_str = cutoff.to_rfc3339();

    // Query for existing feedback within 24h window
    let existing: Option<String> = conn
        .query_row(
            "SELECT reported_at FROM scoring_feedback
             WHERE job_post_id = ? AND reported_at > ?
             ORDER BY reported_at DESC LIMIT 1",
            rusqlite::params![job_post_id, cutoff_str],
            |row: &rusqlite::Row| row.get(0),
        )
        .optional()
        .map_err(|e| {
            FeedbackError::DatabaseError(format!("Failed to check existing feedback: {}", e))
        })?;

    match existing {
        Some(timestamp) => Ok(CanReportResult {
            can_report: false,
            last_reported_at: Some(timestamp),
        }),
        None => Ok(CanReportResult {
            can_report: true,
            last_reported_at: None,
        }),
    }
}

/// Internal function to submit scoring feedback (testable without Tauri State)
fn submit_scoring_feedback_internal(
    conn: &Connection,
    input: SubmitScoringFeedbackInput,
    app_version: String,
) -> Result<ScoringFeedbackResult, FeedbackError> {
    // 1. Validate input
    if input.issues.is_empty() {
        return Err(FeedbackError::ValidationError(
            "At least one issue must be selected".into(),
        ));
    }

    if let Some(ref notes) = input.user_notes {
        let trimmed = notes.trim();
        if trimmed.len() > 500 {
            return Err(FeedbackError::ValidationError(
                "User notes must be 500 characters or less".into(),
            ));
        }
    }

    // 2. Check for duplicate within 24h
    let can_report = check_can_report_internal(conn, input.job_post_id)?;
    if !can_report.can_report {
        return Err(FeedbackError::DuplicateFeedback(
            "You already reported this score".into(),
        ));
    }

    // 3. Snapshot current scores from job_scores table
    let score_snapshot: Option<(Option<f64>, Option<String>, Option<f64>, Option<i32>, Option<i32>)> = conn
        .query_row(
            "SELECT overall_score, color_flag, skills_match_percentage, client_quality_score, budget_alignment_score
             FROM job_scores WHERE job_post_id = ?",
            rusqlite::params![input.job_post_id],
            |row: &rusqlite::Row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .optional()
        .map_err(|e| FeedbackError::DatabaseError(format!("Failed to snapshot scores: {}", e)))?;

    let (overall_score, color_flag, skills_match, client_quality, budget_alignment) =
        score_snapshot.unwrap_or_default();

    // 4. Convert issues to boolean flags
    let mut issue_skills = 0;
    let mut issue_client = 0;
    let mut issue_budget = 0;
    let mut issue_too_high = 0;
    let mut issue_too_low = 0;
    let mut issue_other = 0;

    for issue in &input.issues {
        match issue {
            ScoringFeedbackIssue::SkillsMismatch => issue_skills = 1,
            ScoringFeedbackIssue::ClientQualityWrong => issue_client = 1,
            ScoringFeedbackIssue::BudgetWrong => issue_budget = 1,
            ScoringFeedbackIssue::ScoreTooHigh => issue_too_high = 1,
            ScoringFeedbackIssue::ScoreTooLow => issue_too_low = 1,
            ScoringFeedbackIssue::Other => issue_other = 1,
        }
    }

    // 5. Trim user notes
    let user_notes = input.user_notes.as_ref().map(|s| s.trim().to_string());

    // 6. Insert feedback record
    let feedback_id = conn
        .execute(
            "INSERT INTO scoring_feedback (
                job_post_id,
                overall_score_at_report,
                color_flag_at_report,
                skills_match_at_report,
                client_quality_at_report,
                budget_alignment_at_report,
                issue_skills_mismatch,
                issue_client_quality,
                issue_budget_wrong,
                issue_score_too_high,
                issue_score_too_low,
                issue_other,
                user_notes,
                app_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                input.job_post_id,
                overall_score,
                color_flag,
                skills_match,
                client_quality,
                budget_alignment,
                issue_skills,
                issue_client,
                issue_budget,
                issue_too_high,
                issue_too_low,
                issue_other,
                user_notes,
                app_version,
            ],
        )
        .map_err(|e| FeedbackError::DatabaseError(format!("Failed to insert feedback: {}", e)))?;

    info!(
        "Scoring feedback submitted: job_post_id={}, feedback_id={}",
        input.job_post_id, feedback_id
    );

    Ok(ScoringFeedbackResult {
        feedback_id: conn.last_insert_rowid(),
        success: true,
    })
}

/// Tauri command: Check if user can report score for a job
#[tauri::command]
pub async fn check_can_report_score(
    job_post_id: i64,
    database: State<'_, AppDatabase>,
) -> Result<CanReportResult, String> {
    let database = database.get()?;
    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    check_can_report_internal(&conn, job_post_id).map_err(|e| e.into())
}

/// Tauri command: Submit scoring feedback
#[tauri::command]
pub async fn submit_scoring_feedback(
    input: SubmitScoringFeedbackInput,
    database: State<'_, AppDatabase>,
    app: tauri::AppHandle,
) -> Result<ScoringFeedbackResult, String> {
    let database = database.get()?;
    // Get app version from Tauri
    let app_version = app.package_info().version.to_string();

    let conn = database
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    submit_scoring_feedback_internal(&conn, input, app_version).map_err(|e| e.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::TempDir;

    fn setup_test_db() -> (TempDir, Database) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(db_path, None).unwrap();

        // Create tables (using IF NOT EXISTS since Database::new runs migrations)
        let conn = db.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS job_posts (
                id INTEGER PRIMARY KEY,
                raw_content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS job_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_post_id INTEGER UNIQUE NOT NULL,
                overall_score REAL,
                color_flag TEXT,
                skills_match_percentage REAL,
                client_quality_score INTEGER,
                budget_alignment_score INTEGER,
                calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS scoring_feedback (
                id INTEGER PRIMARY KEY,
                job_post_id INTEGER NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
                reported_at TEXT NOT NULL DEFAULT (datetime('now')),
                overall_score_at_report REAL,
                color_flag_at_report TEXT,
                skills_match_at_report REAL,
                client_quality_at_report INTEGER,
                budget_alignment_at_report INTEGER,
                issue_skills_mismatch INTEGER NOT NULL DEFAULT 0,
                issue_client_quality INTEGER NOT NULL DEFAULT 0,
                issue_budget_wrong INTEGER NOT NULL DEFAULT 0,
                issue_score_too_high INTEGER NOT NULL DEFAULT 0,
                issue_score_too_low INTEGER NOT NULL DEFAULT 0,
                issue_other INTEGER NOT NULL DEFAULT 0,
                user_notes TEXT,
                app_version TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_scoring_feedback_job_reported ON scoring_feedback(job_post_id, reported_at DESC);
            ",
        )
        .unwrap();

        drop(conn);
        (temp_dir, db)
    }

    #[test]
    fn test_check_can_report_no_prior_feedback() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();

        let result = check_can_report_internal(&conn, 1).unwrap();
        assert!(result.can_report);
        assert!(result.last_reported_at.is_none());
    }

    #[test]
    fn test_check_can_report_within_24h() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post and score
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_scores (job_post_id, overall_score, color_flag) VALUES (1, 75.0, 'yellow')",
            [],
        )
        .unwrap();

        // Insert feedback 1 hour ago
        let one_hour_ago = (Utc::now() - Duration::hours(1)).to_rfc3339();
        conn.execute(
            "INSERT INTO scoring_feedback (job_post_id, reported_at) VALUES (1, ?)",
            rusqlite::params![one_hour_ago],
        )
        .unwrap();

        let result = check_can_report_internal(&conn, 1).unwrap();
        assert!(!result.can_report);
        assert!(result.last_reported_at.is_some());
    }

    #[test]
    fn test_check_can_report_outside_24h() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();

        // Insert feedback 25 hours ago (outside window)
        let twentyfive_hours_ago = (Utc::now() - Duration::hours(25)).to_rfc3339();
        conn.execute(
            "INSERT INTO scoring_feedback (job_post_id, reported_at) VALUES (1, ?)",
            rusqlite::params![twentyfive_hours_ago],
        )
        .unwrap();

        let result = check_can_report_internal(&conn, 1).unwrap();
        assert!(result.can_report);
        assert!(result.last_reported_at.is_none());
    }

    #[test]
    fn test_submit_feedback_valid() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post and score
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_scores (job_post_id, overall_score, color_flag, skills_match_percentage, client_quality_score, budget_alignment_score)
             VALUES (1, 68.0, 'yellow', 75.0, 60, 90)",
            [],
        )
        .unwrap();

        let input = SubmitScoringFeedbackInput {
            job_post_id: 1,
            issues: vec![
                ScoringFeedbackIssue::SkillsMismatch,
                ScoringFeedbackIssue::ScoreTooLow,
            ],
            user_notes: Some("Skills detection is off".into()),
        };

        let result = submit_scoring_feedback_internal(&conn, input, "1.0.0".into()).unwrap();
        assert!(result.success);
        assert!(result.feedback_id > 0);

        // Verify record was inserted with correct snapshot
        let (score, flag, notes): (Option<f64>, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT overall_score_at_report, color_flag_at_report, user_notes FROM scoring_feedback WHERE id = ?",
                rusqlite::params![result.feedback_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(score, Some(68.0));
        assert_eq!(flag, Some("yellow".into()));
        assert_eq!(notes, Some("Skills detection is off".into()));
    }

    #[test]
    fn test_submit_feedback_duplicate_rejection() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post and score
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_scores (job_post_id, overall_score, color_flag) VALUES (1, 75.0, 'yellow')",
            [],
        )
        .unwrap();

        // Submit first feedback
        let input = SubmitScoringFeedbackInput {
            job_post_id: 1,
            issues: vec![ScoringFeedbackIssue::ScoreTooHigh],
            user_notes: None,
        };
        let result1 = submit_scoring_feedback_internal(&conn, input.clone(), "1.0.0".into());
        assert!(result1.is_ok());

        // Try to submit again (should fail)
        let result2 = submit_scoring_feedback_internal(&conn, input, "1.0.0".into());
        assert!(result2.is_err());
        match result2.unwrap_err() {
            FeedbackError::DuplicateFeedback(msg) => {
                assert_eq!(msg, "You already reported this score");
            }
            _ => panic!("Expected DuplicateFeedback error"),
        }
    }

    #[test]
    fn test_submit_feedback_notes_length_validation() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();

        // Try to submit with notes > 500 chars
        let long_notes = "a".repeat(501);
        let input = SubmitScoringFeedbackInput {
            job_post_id: 1,
            issues: vec![ScoringFeedbackIssue::Other],
            user_notes: Some(long_notes),
        };

        let result = submit_scoring_feedback_internal(&conn, input, "1.0.0".into());
        assert!(result.is_err());
        match result.unwrap_err() {
            FeedbackError::ValidationError(msg) => {
                assert!(msg.contains("500 characters"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[test]
    fn test_submit_feedback_empty_issues() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();

        let input = SubmitScoringFeedbackInput {
            job_post_id: 1,
            issues: vec![], // Empty
            user_notes: None,
        };

        let result = submit_scoring_feedback_internal(&conn, input, "1.0.0".into());
        assert!(result.is_err());
        match result.unwrap_err() {
            FeedbackError::ValidationError(msg) => {
                assert!(msg.contains("At least one issue"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[test]
    fn test_submit_feedback_score_snapshot() {
        let (_temp, db) = setup_test_db();
        let conn = db.conn.lock().unwrap();

        // Insert job post with complete scoring data
        conn.execute(
            "INSERT INTO job_posts (id, raw_content) VALUES (1, 'test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO job_scores (job_post_id, overall_score, color_flag, skills_match_percentage, client_quality_score, budget_alignment_score)
             VALUES (1, 82.5, 'green', 90.0, 85, 100)",
            [],
        )
        .unwrap();

        let input = SubmitScoringFeedbackInput {
            job_post_id: 1,
            issues: vec![ScoringFeedbackIssue::ScoreTooHigh],
            user_notes: None,
        };

        let result = submit_scoring_feedback_internal(&conn, input, "1.0.0".into()).unwrap();

        // Verify all score components were snapshotted
        let (score, color, skills, quality, budget): (
            Option<f64>,
            Option<String>,
            Option<f64>,
            Option<i32>,
            Option<i32>,
        ) = conn
            .query_row(
                "SELECT overall_score_at_report, color_flag_at_report, skills_match_at_report,
                        client_quality_at_report, budget_alignment_at_report
                 FROM scoring_feedback WHERE id = ?",
                rusqlite::params![result.feedback_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(score, Some(82.5));
        assert_eq!(color, Some("green".into()));
        assert_eq!(skills, Some(90.0));
        assert_eq!(quality, Some(85));
        assert_eq!(budget, Some(100));
    }
}
