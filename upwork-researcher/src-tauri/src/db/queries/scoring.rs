//! Job scoring queries for Story 4b.2 (Skills Match Percentage Calculation)
//! Supports FR-4: Weighted Job Scoring

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Job score record from job_scores table
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JobScore {
    pub job_post_id: i64,
    pub skills_match_percentage: Option<f64>,
    pub client_quality_score: Option<i32>,
    pub budget_alignment_score: Option<i32>,
    pub overall_score: Option<f64>,
    pub color_flag: String, // Story 4b.5: "green", "yellow", "red", or "gray"
    pub calculated_at: String,
}

/// Calculate skills match percentage between user skills and job skills (AC-1, AC-3)
///
/// Formula: (user_skills ∩ job_skills) / count(job_skills) * 100
/// Case-insensitive comparison (AC-1)
///
/// Returns:
/// - Ok(None) if user has no skills configured (AC-3: "Configure skills in Settings")
/// - Ok(None) if job has no skills extracted (AC-3: "No skills detected in job post")
/// - Ok(Some(0.0)) if empty intersection (AC-3)
/// - Ok(Some(percentage)) for normal calculation
pub fn calculate_skills_match(
    job_post_id: i64,
    conn: &Connection,
) -> Result<Option<f64>, String> {
    // Subtask 2.2: Query user skills
    let mut stmt = conn
        .prepare("SELECT skill FROM user_skills ORDER BY skill ASC")
        .map_err(|e| format!("Failed to prepare user skills query: {}", e))?;

    let user_skills: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query user skills: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect user skills: {}", e))?;

    // Subtask 2.4: Edge case — no user skills configured
    if user_skills.is_empty() {
        return Ok(None);
    }

    // Subtask 2.3: Query job skills
    let mut stmt = conn
        .prepare("SELECT skill_name FROM job_skills WHERE job_post_id = ? ORDER BY skill_name ASC")
        .map_err(|e| format!("Failed to prepare job skills query: {}", e))?;

    let job_skills: Vec<String> = stmt
        .query_map([job_post_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query job skills: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect job skills: {}", e))?;

    // Subtask 2.5: Edge case — no job skills extracted
    if job_skills.is_empty() {
        return Ok(None);
    }

    // Subtask 2.6: Normalize both sets to lowercase for case-insensitive comparison
    let user_set: HashSet<String> = user_skills.iter().map(|s| s.to_lowercase()).collect();

    let job_set: HashSet<String> = job_skills.iter().map(|s| s.to_lowercase()).collect();

    // Subtask 2.7: Calculate intersection
    let intersection: HashSet<_> = user_set.intersection(&job_set).collect();

    // Subtask 2.8: Calculate percentage
    let percentage = (intersection.len() as f64 / job_set.len() as f64) * 100.0;

    // Subtask 2.9: Round to 1 decimal place
    let rounded = (percentage * 10.0).round() / 10.0;

    // Subtask 2.10: Return Ok(Some(percentage))
    Ok(Some(rounded))
}

/// Store skills match percentage in job_scores table (AC-1)
/// Uses INSERT OR UPDATE (ON CONFLICT) for upsert behavior
pub fn store_skills_match(
    conn: &Connection,
    job_post_id: i64,
    percentage: Option<f64>,
) -> Result<(), String> {
    if let Some(pct) = percentage {
        conn.execute(
            "INSERT INTO job_scores (job_post_id, skills_match_percentage)
             VALUES (?1, ?2)
             ON CONFLICT(job_post_id) DO UPDATE SET
                skills_match_percentage = excluded.skills_match_percentage,
                calculated_at = CURRENT_TIMESTAMP",
            params![job_post_id, pct],
        )
        .map_err(|e| format!("Failed to store skills match: {}", e))?;
    }
    Ok(())
}

/// Store client quality score in job_scores table (Story 4b.3 AC-1)
/// Uses INSERT OR UPDATE (ON CONFLICT) for upsert behavior
/// Preserves existing skills_match_percentage if row already exists
pub fn store_client_quality_score(
    conn: &Connection,
    job_post_id: i64,
    score: Option<i32>,
) -> Result<(), String> {
    if let Some(s) = score {
        conn.execute(
            "INSERT INTO job_scores (job_post_id, client_quality_score)
             VALUES (?1, ?2)
             ON CONFLICT(job_post_id) DO UPDATE SET
                client_quality_score = excluded.client_quality_score,
                calculated_at = CURRENT_TIMESTAMP",
            params![job_post_id, s],
        )
        .map_err(|e| format!("Failed to store client quality score: {}", e))?;
    }
    Ok(())
}

/// Store budget alignment score in job_scores table (Story 4b.4 / 4b.5 Review Fix)
/// Uses INSERT OR UPDATE (ON CONFLICT) for upsert behavior
/// Preserves existing skills_match_percentage and client_quality_score if row already exists
pub fn store_budget_alignment_score(
    conn: &Connection,
    job_post_id: i64,
    score: Option<i32>,
) -> Result<(), String> {
    if let Some(s) = score {
        conn.execute(
            "INSERT INTO job_scores (job_post_id, budget_alignment_score)
             VALUES (?1, ?2)
             ON CONFLICT(job_post_id) DO UPDATE SET
                budget_alignment_score = excluded.budget_alignment_score,
                calculated_at = CURRENT_TIMESTAMP",
            params![job_post_id, s],
        )
        .map_err(|e| format!("Failed to store budget alignment score: {}", e))?;
    }
    Ok(())
}

/// Store overall score and color flag in job_scores table (Story 4b.5 Task 2.2)
/// Uses INSERT OR UPDATE (ON CONFLICT) for upsert behavior
/// Preserves existing component scores if row already exists
pub fn upsert_overall_score(
    conn: &Connection,
    job_post_id: i64,
    overall_score: Option<f64>,
    color_flag: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO job_scores (job_post_id, overall_score, color_flag)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(job_post_id) DO UPDATE SET
            overall_score = excluded.overall_score,
            color_flag = excluded.color_flag,
            calculated_at = CURRENT_TIMESTAMP",
        params![job_post_id, overall_score, color_flag],
    )
    .map_err(|e| format!("Failed to upsert overall score: {}", e))?;
    Ok(())
}

/// Retrieve stored job score by job_post_id (Task 4)
/// Returns None if no score exists yet
pub fn get_job_score(
    conn: &Connection,
    job_post_id: i64,
) -> Result<Option<JobScore>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT job_post_id, skills_match_percentage, client_quality_score,
                    budget_alignment_score, overall_score, color_flag, calculated_at
             FROM job_scores WHERE job_post_id = ?",
        )
        .map_err(|e| format!("Failed to prepare job score query: {}", e))?;

    let result = stmt
        .query_row([job_post_id], |row| {
            Ok(JobScore {
                job_post_id: row.get(0)?,
                skills_match_percentage: row.get(1)?,
                client_quality_score: row.get(2)?,
                budget_alignment_score: row.get(3)?,
                overall_score: row.get(4)?,
                color_flag: row.get(5)?,
                calculated_at: row.get(6)?,
            })
        });

    match result {
        Ok(score) => Ok(Some(score)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get job score: {}", e)),
    }
}

/// Get matched and missing skills for scoring breakdown (Story 4b.6)
///
/// Returns (matched_skills, missing_skills, total_job_skills_count)
pub fn get_skills_breakdown(
    conn: &Connection,
    job_post_id: i64,
) -> Result<(Vec<String>, Vec<String>, i32), String> {
    // Get user skills (lowercase for comparison)
    let mut stmt = conn
        .prepare("SELECT skill FROM user_skills ORDER BY skill ASC")
        .map_err(|e| format!("Failed to prepare user skills query: {}", e))?;

    let user_skills: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query user skills: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect user skills: {}", e))?;

    let user_set: HashSet<String> = user_skills.iter().map(|s| s.to_lowercase()).collect();

    // Get job skills (case-insensitive)
    let mut stmt = conn
        .prepare("SELECT skill_name FROM job_skills WHERE job_post_id = ? ORDER BY skill_name ASC")
        .map_err(|e| format!("Failed to prepare job skills query: {}", e))?;

    let job_skills: Vec<String> = stmt
        .query_map([job_post_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query job skills: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect job skills: {}", e))?;

    let mut matched = Vec::new();
    let mut missing = Vec::new();

    for skill in &job_skills {
        if user_set.contains(&skill.to_lowercase()) {
            matched.push(skill.clone());
        } else {
            missing.push(skill.clone());
        }
    }

    Ok((matched, missing, job_skills.len() as i32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        // Create required tables (matching production migrations)
        conn.execute_batch(
            r#"
            CREATE TABLE job_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT,
                raw_content TEXT NOT NULL,
                client_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE job_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_post_id INTEGER NOT NULL,
                skill_name TEXT NOT NULL,
                FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_job_skills_job_post_id ON job_skills(job_post_id);

            CREATE TABLE user_skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                skill TEXT NOT NULL,
                added_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_primary BOOLEAN DEFAULT 0,
                UNIQUE(skill COLLATE NOCASE)
            );

            CREATE TABLE job_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_post_id INTEGER UNIQUE NOT NULL,
                skills_match_percentage REAL,
                client_quality_score INTEGER,
                budget_alignment_score INTEGER,
                overall_score REAL,
                color_flag TEXT DEFAULT 'gray',
                calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_job_scores_job_post_id ON job_scores(job_post_id);
            CREATE INDEX idx_job_scores_overall ON job_scores(overall_score DESC);
            CREATE INDEX idx_job_scores_color_flag ON job_scores(color_flag);
            "#,
        )
        .unwrap();

        conn
    }

    fn insert_job_post(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO job_posts (raw_content) VALUES (?)",
            params!["Test job post"],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn add_user_skills(conn: &Connection, skills: &[&str]) {
        for skill in skills {
            conn.execute(
                "INSERT INTO user_skills (skill) VALUES (?)",
                params![skill],
            )
            .unwrap();
        }
    }

    fn add_job_skills(conn: &Connection, job_post_id: i64, skills: &[&str]) {
        for skill in skills {
            conn.execute(
                "INSERT INTO job_skills (job_post_id, skill_name) VALUES (?, ?)",
                params![job_post_id, skill],
            )
            .unwrap();
        }
    }

    // ==========================================
    // Subtask 6.1: Perfect match (100%)
    // ==========================================
    #[test]
    fn test_calculate_skills_match_perfect() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["React", "TypeScript", "Node.js"]);
        add_job_skills(&conn, job_id, &["React", "TypeScript", "Node.js"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, Some(100.0));
    }

    // ==========================================
    // Subtask 6.2: Partial match (67%)
    // ==========================================
    #[test]
    fn test_calculate_skills_match_partial() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["React", "TypeScript"]);
        add_job_skills(&conn, job_id, &["React", "TypeScript", "Node.js"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, Some(66.7)); // 2/3 = 66.666... rounded to 66.7
    }

    // ==========================================
    // Subtask 6.3: No match (0%)
    // ==========================================
    #[test]
    fn test_calculate_skills_match_zero() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["Python", "Django"]);
        add_job_skills(&conn, job_id, &["React", "TypeScript", "Node.js"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, Some(0.0));
    }

    // ==========================================
    // Subtask 6.4: Case-insensitive matching
    // ==========================================
    #[test]
    fn test_calculate_skills_match_case_insensitive() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["react", "typescript"]);
        add_job_skills(&conn, job_id, &["React", "TypeScript"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, Some(100.0));
    }

    // ==========================================
    // Subtask 6.5: No user skills → None
    // ==========================================
    #[test]
    fn test_calculate_skills_match_no_user_skills() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // No user skills added
        add_job_skills(&conn, job_id, &["React", "TypeScript"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, None);
    }

    // ==========================================
    // Subtask 6.6: No job skills → None
    // ==========================================
    #[test]
    fn test_calculate_skills_match_no_job_skills() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["React", "TypeScript"]);
        // No job skills added

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, None);
    }

    // ==========================================
    // Subtask 6.7: Empty intersection → Some(0.0)
    // ==========================================
    #[test]
    fn test_calculate_skills_match_empty_intersection() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["Go", "Rust"]);
        add_job_skills(&conn, job_id, &["Python", "Java"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, Some(0.0));
    }

    // ==========================================
    // Subtask 6.8: store_skills_match inserts score
    // ==========================================
    #[test]
    fn test_store_skills_match_inserts() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_skills_match(&conn, job_id, Some(75.0)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.skills_match_percentage, Some(75.0));
        assert_eq!(score.job_post_id, job_id);
    }

    // ==========================================
    // Subtask 6.9: store_skills_match updates (ON CONFLICT)
    // ==========================================
    #[test]
    fn test_store_skills_match_updates_existing() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // Insert first
        store_skills_match(&conn, job_id, Some(50.0)).unwrap();
        // Update
        store_skills_match(&conn, job_id, Some(80.0)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.skills_match_percentage, Some(80.0));
    }

    // ==========================================
    // Subtask 6.10: get_job_score retrieves correctly
    // ==========================================
    #[test]
    fn test_get_job_score_returns_none_when_empty() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        let result = get_job_score(&conn, job_id).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_get_job_score_retrieves_stored() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_skills_match(&conn, job_id, Some(66.7)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.job_post_id, job_id);
        assert_eq!(score.skills_match_percentage, Some(66.7));
        assert_eq!(score.client_quality_score, None);
        assert_eq!(score.budget_alignment_score, None);
        assert_eq!(score.overall_score, None);
        assert_eq!(score.color_flag, "gray"); // Default
        assert!(!score.calculated_at.is_empty());
    }

    // ==========================================
    // Additional edge case: store None does nothing
    // ==========================================
    #[test]
    fn test_store_skills_match_none_is_noop() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_skills_match(&conn, job_id, None).unwrap();

        let result = get_job_score(&conn, job_id).unwrap();
        assert_eq!(result, None);
    }

    // ==========================================
    // User has MORE skills than job requires
    // ==========================================
    #[test]
    fn test_calculate_skills_match_user_has_extra_skills() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["React", "TypeScript", "Node.js", "Python", "Rust"]);
        add_job_skills(&conn, job_id, &["React", "TypeScript"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(result, Some(100.0)); // 2/2 = 100%
    }

    // ==========================================
    // Story 4b.3: Client Quality Score Storage Tests
    // ==========================================

    #[test]
    fn test_store_client_quality_score_inserts() {
        // Subtask 5.7: Test score storage in job_scores table
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_client_quality_score(&conn, job_id, Some(85)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.client_quality_score, Some(85));
        assert_eq!(score.job_post_id, job_id);
    }

    #[test]
    fn test_store_client_quality_score_updates_existing() {
        // Subtask 2.4: Handle case where row exists → UPDATE only client_quality_score
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_client_quality_score(&conn, job_id, Some(70)).unwrap();
        store_client_quality_score(&conn, job_id, Some(85)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.client_quality_score, Some(85));
    }

    #[test]
    fn test_store_client_quality_score_preserves_skills_match() {
        // Subtask 2.4: skills_match_percentage already exists → preserve it
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // Store skills match first (Story 4b.2)
        store_skills_match(&conn, job_id, Some(75.0)).unwrap();
        // Then store client quality score (Story 4b.3)
        store_client_quality_score(&conn, job_id, Some(85)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.skills_match_percentage, Some(75.0)); // Preserved
        assert_eq!(score.client_quality_score, Some(85)); // Updated
    }

    #[test]
    fn test_store_client_quality_score_none_is_noop() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_client_quality_score(&conn, job_id, None).unwrap();

        let result = get_job_score(&conn, job_id).unwrap();
        assert_eq!(result, None); // No row created
    }

    #[test]
    fn test_get_job_score_with_client_quality() {
        // Subtask 5.8: Test score retrieval via get_job_score
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_client_quality_score(&conn, job_id, Some(45)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.client_quality_score, Some(45));
        assert_eq!(score.skills_match_percentage, None); // Not set
        assert_eq!(score.budget_alignment_score, None); // Not set
    }

    // ==========================================
    // Story 4b.3 Review: Round-trip test for both scores
    // ==========================================
    #[test]
    fn test_get_job_score_full_round_trip() {
        // M3 Review Fix: Verify both skills_match + client_quality survive round-trip
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // Store skills match first (Story 4b.2)
        store_skills_match(&conn, job_id, Some(75.5)).unwrap();

        // Store client quality score (Story 4b.3)
        store_client_quality_score(&conn, job_id, Some(82)).unwrap();

        // Retrieve and verify both values are preserved
        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.job_post_id, job_id);
        assert_eq!(score.skills_match_percentage, Some(75.5));
        assert_eq!(score.client_quality_score, Some(82));
        assert_eq!(score.budget_alignment_score, None); // Not set yet
        assert_eq!(score.overall_score, None); // Not set yet
        assert_eq!(score.color_flag, "gray"); // Default
    }

    // ==========================================
    // H1 Review Fix: Duplicate job skills handling
    // Formula uses deduplicated set - verify expected behavior
    // ==========================================
    #[test]
    fn test_calculate_skills_match_with_duplicate_job_skills() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        add_user_skills(&conn, &["React"]);
        // Job has duplicate skills (could happen from LLM extraction)
        add_job_skills(&conn, job_id, &["React", "React", "TypeScript"]);

        let result = calculate_skills_match(job_id, &conn).unwrap();
        // Implementation uses deduplicated set: 1/2 unique skills = 50%
        // This is intentional - duplicates from LLM are normalized
        assert_eq!(result, Some(50.0));
    }

    // ==========================================
    // Story 4b.5 Review Fix: Budget Alignment Score Storage Tests
    // ==========================================

    #[test]
    fn test_store_budget_alignment_score_inserts() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_budget_alignment_score(&conn, job_id, Some(85)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.budget_alignment_score, Some(85));
        assert_eq!(score.job_post_id, job_id);
    }

    #[test]
    fn test_store_budget_alignment_score_updates_existing() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_budget_alignment_score(&conn, job_id, Some(60)).unwrap();
        store_budget_alignment_score(&conn, job_id, Some(90)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.budget_alignment_score, Some(90));
    }

    #[test]
    fn test_store_budget_alignment_score_preserves_other_components() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // Store other components first
        store_skills_match(&conn, job_id, Some(75.0)).unwrap();
        store_client_quality_score(&conn, job_id, Some(80)).unwrap();

        // Store budget alignment
        store_budget_alignment_score(&conn, job_id, Some(70)).unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.skills_match_percentage, Some(75.0)); // Preserved
        assert_eq!(score.client_quality_score, Some(80)); // Preserved
        assert_eq!(score.budget_alignment_score, Some(70)); // Updated
    }

    #[test]
    fn test_store_budget_alignment_score_none_is_noop() {
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        store_budget_alignment_score(&conn, job_id, None).unwrap();

        let result = get_job_score(&conn, job_id).unwrap();
        assert_eq!(result, None); // No row created
    }

    // ==========================================
    // Story 4b.5: Overall Score and Color Flag Storage Tests
    // ==========================================

    #[test]
    fn test_upsert_overall_score_inserts() {
        // Task 2.3: Test upsert inserts new row
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        upsert_overall_score(&conn, job_id, Some(78.5), "yellow").unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.overall_score, Some(78.5));
        assert_eq!(score.color_flag, "yellow");
        assert_eq!(score.job_post_id, job_id);
    }

    #[test]
    fn test_upsert_overall_score_updates_existing() {
        // Task 2.3: Test upsert updates existing row
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        upsert_overall_score(&conn, job_id, Some(60.0), "yellow").unwrap();
        upsert_overall_score(&conn, job_id, Some(85.0), "green").unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.overall_score, Some(85.0));
        assert_eq!(score.color_flag, "green");
    }

    #[test]
    fn test_upsert_overall_score_preserves_components() {
        // Task 2.3: Verify component scores are preserved when upserting overall score
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // Store component scores first
        store_skills_match(&conn, job_id, Some(75.0)).unwrap();
        store_client_quality_score(&conn, job_id, Some(80)).unwrap();

        // Upsert overall score
        upsert_overall_score(&conn, job_id, Some(77.0), "green").unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.skills_match_percentage, Some(75.0)); // Preserved
        assert_eq!(score.client_quality_score, Some(80)); // Preserved
        assert_eq!(score.overall_score, Some(77.0)); // Updated
        assert_eq!(score.color_flag, "green"); // Updated
    }

    #[test]
    fn test_upsert_overall_score_with_none() {
        // Task 2.3: Test upserting None score (gray flag)
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        upsert_overall_score(&conn, job_id, None, "gray").unwrap();

        let score = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score.overall_score, None);
        assert_eq!(score.color_flag, "gray");
    }

    #[test]
    fn test_upsert_overall_score_all_color_flags() {
        // Task 2.3: Test all color flag values
        let conn = setup_test_db();

        for (flag, expected_score) in [
            ("green", 85.0),
            ("yellow", 65.0),
            ("red", 40.0),
            ("gray", 0.0),
        ] {
            let job_id = insert_job_post(&conn);
            upsert_overall_score(&conn, job_id, Some(expected_score), flag).unwrap();

            let score = get_job_score(&conn, job_id).unwrap().unwrap();
            assert_eq!(score.color_flag, flag);
            assert_eq!(score.overall_score, Some(expected_score));
        }
    }

    // ==========================================
    // M3 Fix: Integration test for score recalculation behavior
    // Tests the underlying logic that recalculate_all_scores depends on
    // ==========================================
    #[test]
    fn test_recalculation_scenario_skill_added() {
        // M3: Simulates recalculate_all_scores behavior after user adds a skill
        // This tests the DB-level operations that the Tauri command orchestrates
        let conn = setup_test_db();
        let job_id = insert_job_post(&conn);

        // 1. Setup: Job requires React, TypeScript, Node.js
        add_job_skills(&conn, job_id, &["React", "TypeScript", "Node.js"]);

        // 2. User has only React initially → 33% match
        add_user_skills(&conn, &["React"]);
        let initial_match = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(initial_match, Some(33.3));

        // Store initial score
        store_skills_match(&conn, job_id, initial_match).unwrap();
        store_client_quality_score(&conn, job_id, Some(80)).unwrap();
        store_budget_alignment_score(&conn, job_id, Some(100)).unwrap();

        // Calculate and store overall score (simulating calculate_overall_job_score)
        let result = crate::scoring::calculate_overall_score(
            initial_match,
            Some(80),
            Some(100),
        );
        upsert_overall_score(&conn, job_id, result.overall_score, &result.color_flag).unwrap();

        let score_before = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score_before.skills_match_percentage, Some(33.3));
        assert_eq!(score_before.color_flag, "red"); // skills < 50 → red

        // 3. User adds TypeScript skill
        conn.execute(
            "INSERT INTO user_skills (skill) VALUES (?)",
            rusqlite::params!["TypeScript"],
        ).unwrap();

        // 4. Recalculate (simulating recalculate_all_scores)
        let new_match = calculate_skills_match(job_id, &conn).unwrap();
        assert_eq!(new_match, Some(66.7)); // Now 2/3 = 66.7%

        store_skills_match(&conn, job_id, new_match).unwrap();

        let new_result = crate::scoring::calculate_overall_score(
            new_match,
            Some(80),
            Some(100),
        );
        upsert_overall_score(&conn, job_id, new_result.overall_score, &new_result.color_flag).unwrap();

        // 5. Verify score was updated
        let score_after = get_job_score(&conn, job_id).unwrap().unwrap();
        assert_eq!(score_after.skills_match_percentage, Some(66.7));
        assert_eq!(score_after.color_flag, "yellow"); // skills 50-74 → yellow

        // Verify overall score changed (weighted: skills 40% + quality 40% + budget 20%)
        // Before: (33.3 * 0.4) + (80 * 0.4) + (100 * 0.2) = 13.32 + 32 + 20 = 65.3
        // After:  (66.7 * 0.4) + (80 * 0.4) + (100 * 0.2) = 26.68 + 32 + 20 = 78.7
        assert!(score_after.overall_score.unwrap() > score_before.overall_score.unwrap());
    }

    #[test]
    fn test_recalculation_scenario_multiple_jobs() {
        // M3: Verifies recalculation works across multiple job_scores rows
        let conn = setup_test_db();

        // Create 3 jobs with different skill requirements
        let job1 = insert_job_post(&conn);
        let job2 = insert_job_post(&conn);
        let job3 = insert_job_post(&conn);

        add_job_skills(&conn, job1, &["React"]);
        add_job_skills(&conn, job2, &["React", "TypeScript"]);
        add_job_skills(&conn, job3, &["Python", "Django"]);

        // User has React only
        add_user_skills(&conn, &["React"]);

        // Calculate and store scores for all jobs
        for job_id in [job1, job2, job3] {
            let match_pct = calculate_skills_match(job_id, &conn).unwrap();
            store_skills_match(&conn, job_id, match_pct).unwrap();
            store_client_quality_score(&conn, job_id, Some(80)).unwrap();

            let result = crate::scoring::calculate_overall_score(match_pct, Some(80), Some(0));
            upsert_overall_score(&conn, job_id, result.overall_score, &result.color_flag).unwrap();
        }

        // Verify initial scores
        let s1 = get_job_score(&conn, job1).unwrap().unwrap();
        let s2 = get_job_score(&conn, job2).unwrap().unwrap();
        let s3 = get_job_score(&conn, job3).unwrap().unwrap();

        assert_eq!(s1.skills_match_percentage, Some(100.0)); // 1/1
        assert_eq!(s2.skills_match_percentage, Some(50.0));  // 1/2
        assert_eq!(s3.skills_match_percentage, Some(0.0));   // 0/2

        // User adds TypeScript
        conn.execute("INSERT INTO user_skills (skill) VALUES ('TypeScript')", []).unwrap();

        // Recalculate all (simulating recalculate_all_scores iteration)
        let all_job_ids: Vec<i64> = conn
            .prepare("SELECT DISTINCT job_post_id FROM job_scores")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        for job_id in all_job_ids {
            let match_pct = calculate_skills_match(job_id, &conn).unwrap();
            store_skills_match(&conn, job_id, match_pct).unwrap();

            let existing = get_job_score(&conn, job_id).unwrap().unwrap();
            let result = crate::scoring::calculate_overall_score(
                match_pct,
                existing.client_quality_score,
                existing.budget_alignment_score,
            );
            upsert_overall_score(&conn, job_id, result.overall_score, &result.color_flag).unwrap();
        }

        // Verify updated scores
        let s1_new = get_job_score(&conn, job1).unwrap().unwrap();
        let s2_new = get_job_score(&conn, job2).unwrap().unwrap();
        let s3_new = get_job_score(&conn, job3).unwrap().unwrap();

        assert_eq!(s1_new.skills_match_percentage, Some(100.0)); // Still 1/1 (React)
        assert_eq!(s2_new.skills_match_percentage, Some(100.0)); // Now 2/2 (React + TypeScript)
        assert_eq!(s3_new.skills_match_percentage, Some(0.0));   // Still 0/2 (Python, Django)

        // Job2 should have improved color flag (was yellow at 50%, now green at 100%)
        assert_eq!(s2.color_flag, "yellow");
        assert_eq!(s2_new.color_flag, "green");
    }
}
