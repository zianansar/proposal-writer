//! Job scoring engine (Story 4b.5)
//!
//! Calculates overall job scores using weighted formula and determines color flags
//! based on component thresholds.
//!
//! Also includes scoring feedback types for Story 4b.10.

use serde::{Deserialize, Serialize};

/// Result of job scoring calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoringResult {
    /// Overall score (0-100) using weighted formula, or None if skills_match missing
    pub overall_score: Option<f64>,
    /// Color flag: "green", "yellow", "red", or "gray"
    pub color_flag: String,
}

/// Calculate overall job score using weighted formula
///
/// # Weights
/// - Skills match: 40%
/// - Client quality: 40%
/// - Budget alignment: 20%
///
/// # Color Flag Logic (component thresholds, NOT weighted average)
/// - **Green:** skills_match ≥ 75 AND client_quality ≥ 80
/// - **Yellow:** skills_match 50-74 OR client_quality 60-79 (and not Red)
/// - **Red:** skills_match < 50 OR client_quality < 60 OR 0-hire client
/// - **Gray:** skills_match is None (baseline requirement missing)
///
/// # Missing Component Handling
/// - skills_match = None → returns None score with "gray" flag
/// - client_quality = None → defaults to 65 (Yellow-range)
/// - budget_alignment = None → defaults to 0 (contributes 0 to weighted calc)
/// - 0-hire client detected (quality ≤ 45) → forces "red" flag
pub fn calculate_overall_score(
    skills_match: Option<f64>,
    client_quality: Option<i32>,
    budget_alignment: Option<i32>,
) -> ScoringResult {
    // 1. Check required baseline
    let skills = match skills_match {
        Some(s) => s,
        None => {
            return ScoringResult {
                overall_score: None,
                color_flag: "gray".into(),
            }
        }
    };

    // 2. Default missing components
    let quality = client_quality.unwrap_or(65) as f64;
    let budget = budget_alignment.unwrap_or(0) as f64;

    // 3. Weighted calculation: (skills * 0.4) + (quality * 0.4) + (budget * 0.2)
    let score = (skills * 0.4) + (quality * 0.4) + (budget * 0.2);
    let score = (score * 10.0).round() / 10.0; // Round to 1 decimal place

    // 4. Color flag from component thresholds
    let is_zero_hire = client_quality.map_or(false, |q| q <= 45);
    let flag = determine_color_flag(skills, client_quality.unwrap_or(65), is_zero_hire);

    ScoringResult {
        overall_score: Some(score),
        color_flag: flag,
    }
}

/// Determine color flag based on component thresholds
///
/// Uses individual component thresholds, NOT the weighted average.
pub fn determine_color_flag(skills_match: f64, client_quality: i32, is_zero_hire: bool) -> String {
    // Red: skills < 50 OR quality < 60 OR 0-hire client
    if skills_match < 50.0 || client_quality < 60 || is_zero_hire {
        "red".into()
    }
    // Green: skills ≥ 75 AND quality ≥ 80
    else if skills_match >= 75.0 && client_quality >= 80 {
        "green".into()
    }
    // Yellow: everything else (skills 50-74 OR quality 60-79)
    else {
        "yellow".into()
    }
}

/// Scoring breakdown for detailed UI display (Story 4b.6)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoringBreakdown {
    // Overall
    pub overall_score: Option<f64>,
    pub color_flag: String,

    // Skills Match component
    pub skills_match_pct: Option<f64>,
    pub skills_matched_count: i32,
    pub skills_total_count: i32,
    pub skills_matched_list: Vec<String>,
    pub skills_missing_list: Vec<String>,

    // Client Quality component
    pub client_quality_score: Option<i32>,
    pub client_quality_signals: String,

    // Budget Alignment component
    pub budget_alignment_pct: Option<i32>,
    pub budget_display: String,
    pub budget_type: String,

    // Recommendation
    pub recommendation: String,
}

/// Generate recommendation text based on color flag and component analysis
///
/// Pure Rust logic - no LLM call. Returns human-readable guidance for the user.
fn generate_recommendation(
    color_flag: &str,
    skills_pct: Option<f64>,
    quality: Option<i32>,
    budget_pct: Option<i32>,
) -> String {
    match color_flag {
        "green" => {
            "Strong match. This job aligns well with your skills and the client looks reliable."
                .into()
        }
        "yellow" => {
            // Identify the weakest component and call it out
            let mut reasons = Vec::new();
            if let Some(s) = skills_pct {
                if s < 75.0 {
                    reasons.push("skills gap");
                }
            }
            if let Some(q) = quality {
                if q < 80 {
                    reasons.push("client history");
                }
            }
            if let Some(b) = budget_pct {
                if b < 100 {
                    reasons.push("budget");
                }
            }
            if reasons.is_empty() {
                "Proceed with caution. Review the job details carefully before applying.".into()
            } else {
                format!(
                    "Proceed with caution. Review {} before applying.",
                    reasons.join(" and ")
                )
            }
        }
        "red" => {
            if quality.map_or(false, |q| q <= 45) {
                "High risk. Client has no hire history — proceed only if the project is compelling."
                    .into()
            } else {
                "Low priority. Significant gaps in skills match or client quality.".into()
            }
        }
        _ => "Insufficient data to assess. Configure your skills and rates in Settings.".into(),
    }
}

/// Generate client quality signals text based on score range (Story 4b.6)
///
/// Uses score-derived text (Option 1 from Dev Notes) - simpler, no schema change needed
fn generate_client_quality_signals(score: Option<i32>) -> String {
    match score {
        Some(s) if s >= 80 => "Client appears reliable with good hire history".into(),
        Some(s) if s >= 60 => "Limited client history, moderate confidence".into(),
        Some(s) if s <= 45 => "Client has 0 hires or significant red flags".into(),
        Some(_) => "New or problematic client signals detected".into(),
        None => "Client quality not assessed yet".into(),
    }
}

/// Generate budget display text (Story 4b.6)
///
/// Formats budget data into human-readable string like "$55/hr vs your $50/hr rate"
fn generate_budget_display(
    budget_min: Option<f64>,
    budget_max: Option<f64>,
    budget_type: &str,
    user_hourly_rate: Option<f64>,
) -> String {
    match budget_type {
        "hourly" => {
            if let (Some(job_rate), Some(user_rate)) = (budget_min, user_hourly_rate) {
                format!(
                    "${}/hr vs your ${}/hr rate",
                    job_rate as i32, user_rate as i32
                )
            } else if let Some(job_rate) = budget_min {
                format!("${}/hr (rate not configured)", job_rate as i32)
            } else {
                "Hourly rate not specified".into()
            }
        }
        "fixed" => {
            if let (Some(min), Some(max)) = (budget_min, budget_max) {
                if min == max {
                    format!("${} fixed project", min as i32)
                } else {
                    format!("${}-${} fixed project", min as i32, max as i32)
                }
            } else if let Some(amount) = budget_min {
                format!("${} fixed project", amount as i32)
            } else {
                "Fixed budget not specified".into()
            }
        }
        "unknown" => "Budget not specified in job post".into(),
        _ => "Unknown budget type".into(),
    }
}

/// Assemble complete scoring breakdown for UI display (Story 4b.6)
///
/// Queries database for all component data and generates human-readable breakdown.
///
/// Note: Skills match percentage is recalculated from current user skills at breakdown time
/// to ensure consistency between the percentage and the matched/missing skills lists.
/// This handles the case where user skills were updated after the original scoring.
pub fn assemble_scoring_breakdown(
    conn: &rusqlite::Connection,
    job_post_id: i64,
) -> Result<ScoringBreakdown, String> {
    // 1. Get job score (overall + components)
    let score = crate::db::queries::scoring::get_job_score(conn, job_post_id)?
        .ok_or_else(|| format!("No score found for job_post_id {}", job_post_id))?;

    // 2. Get skills breakdown (matched/missing) based on CURRENT user skills
    let (matched_skills, missing_skills, total_count) =
        crate::db::queries::scoring::get_skills_breakdown(conn, job_post_id)?;

    // 3. Recalculate skills match percentage from current data to ensure consistency
    // (H2 fix: prevents mismatch when user skills changed after original scoring)
    let skills_match_pct = if total_count > 0 {
        let pct = (matched_skills.len() as f64 / total_count as f64) * 100.0;
        Some((pct * 10.0).round() / 10.0) // Round to 1 decimal
    } else {
        // No job skills detected - check if user has skills configured
        let user_skills_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM user_skills", [], |row| row.get(0))
            .unwrap_or(0);
        if user_skills_count == 0 {
            None // No user skills configured
        } else {
            None // No job skills detected
        }
    };

    // 4. Get budget data from job_posts table
    let (budget_min, budget_max, budget_type): (Option<f64>, Option<f64>, String) = conn
        .query_row(
            "SELECT budget_min, budget_max, budget_type FROM job_posts WHERE id = ?",
            rusqlite::params![job_post_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Failed to query budget data: {}", e))?;

    // 5. Get user's hourly rate from settings
    let user_hourly_rate: Option<f64> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'hourly_rate'",
            [],
            |row| row.get(0),
        )
        .ok()
        .and_then(|s: Option<String>| s)
        .and_then(|s| s.parse::<f64>().ok());

    // 6. Generate client quality signals
    let client_quality_signals = generate_client_quality_signals(score.client_quality_score);

    // 7. Generate budget display
    let budget_display =
        generate_budget_display(budget_min, budget_max, &budget_type, user_hourly_rate);

    // 8. Generate recommendation using recalculated skills percentage
    let recommendation = generate_recommendation(
        &score.color_flag,
        skills_match_pct,
        score.client_quality_score,
        score.budget_alignment_score,
    );

    // 9. Assemble breakdown
    Ok(ScoringBreakdown {
        overall_score: score.overall_score,
        color_flag: score.color_flag,
        skills_match_pct,
        skills_matched_count: matched_skills.len() as i32,
        skills_total_count: total_count,
        skills_matched_list: matched_skills,
        skills_missing_list: missing_skills,
        client_quality_score: score.client_quality_score,
        client_quality_signals,
        budget_alignment_pct: score.budget_alignment_score,
        budget_display,
        budget_type,
        recommendation,
    })
}

// ============================================================================
// Scoring Feedback Types (Story 4b.10)
// ============================================================================

/// Scoring feedback issue categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ScoringFeedbackIssue {
    SkillsMismatch,
    ClientQualityWrong,
    BudgetWrong,
    ScoreTooHigh,
    ScoreTooLow,
    Other,
}

/// Input for submitting scoring feedback
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitScoringFeedbackInput {
    pub job_post_id: i64,
    pub issues: Vec<ScoringFeedbackIssue>,
    pub user_notes: Option<String>,
}

/// Result of feedback submission
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoringFeedbackResult {
    pub feedback_id: i64,
    pub success: bool,
}

/// Result of checking if user can report a score
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanReportResult {
    pub can_report: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_reported_at: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_perfect_score() {
        let result = calculate_overall_score(Some(100.0), Some(100), Some(100));
        assert_eq!(result.overall_score, Some(100.0));
        assert_eq!(result.color_flag, "green");
    }

    #[test]
    fn test_zero_score() {
        let result = calculate_overall_score(Some(0.0), Some(0), Some(0));
        assert_eq!(result.overall_score, Some(0.0));
        assert_eq!(result.color_flag, "red");
    }

    #[test]
    fn test_green_threshold() {
        let result = calculate_overall_score(Some(75.0), Some(80), Some(100));
        // (75 * 0.4) + (80 * 0.4) + (100 * 0.2) = 30 + 32 + 20 = 82.0
        assert_eq!(result.overall_score, Some(82.0));
        assert_eq!(result.color_flag, "green");
    }

    #[test]
    fn test_yellow_skills_boundary() {
        // Skills at 74.9, quality at 80 → should be yellow (not green)
        let result = calculate_overall_score(Some(74.9), Some(80), Some(100));
        assert_eq!(result.color_flag, "yellow");
    }

    #[test]
    fn test_yellow_quality_boundary() {
        // Skills at 75, quality at 79 → should be yellow (not green)
        let result = calculate_overall_score(Some(75.0), Some(79), Some(100));
        assert_eq!(result.color_flag, "yellow");
    }

    #[test]
    fn test_red_skills() {
        // Skills at 49.9, quality at 90 → should be red
        let result = calculate_overall_score(Some(49.9), Some(90), Some(100));
        assert_eq!(result.color_flag, "red");
    }

    #[test]
    fn test_red_quality() {
        // Skills at 90, quality at 59 → should be red
        let result = calculate_overall_score(Some(90.0), Some(59), Some(100));
        assert_eq!(result.color_flag, "red");
    }

    #[test]
    fn test_red_zero_hire() {
        // Skills at 90, quality at 45 (0-hire threshold) → should be red
        let result = calculate_overall_score(Some(90.0), Some(45), Some(100));
        assert_eq!(result.color_flag, "red");
    }

    #[test]
    fn test_missing_skills() {
        // Skills = None → score = None, flag = "gray"
        let result = calculate_overall_score(None, Some(80), Some(100));
        assert_eq!(result.overall_score, None);
        assert_eq!(result.color_flag, "gray");
    }

    #[test]
    fn test_missing_quality_defaults() {
        // Quality = None → defaults to 65
        let result = calculate_overall_score(Some(80.0), None, Some(100));
        // (80 * 0.4) + (65 * 0.4) + (100 * 0.2) = 32 + 26 + 20 = 78.0
        assert_eq!(result.overall_score, Some(78.0));
        // Quality 65 with skills 80 → yellow (quality not in green range)
        assert_eq!(result.color_flag, "yellow");
    }

    #[test]
    fn test_missing_budget_defaults() {
        // Budget = None → defaults to 0
        let result = calculate_overall_score(Some(75.0), Some(80), None);
        // (75 * 0.4) + (80 * 0.4) + (0 * 0.2) = 30 + 32 + 0 = 62.0
        assert_eq!(result.overall_score, Some(62.0));
        assert_eq!(result.color_flag, "green");
    }

    #[test]
    fn test_rounding() {
        // Test 1 decimal place rounding
        let result = calculate_overall_score(Some(67.0), Some(85), Some(90));
        // (67 * 0.4) + (85 * 0.4) + (90 * 0.2) = 26.8 + 34.0 + 18.0 = 78.8
        assert_eq!(result.overall_score, Some(78.8));
    }

    #[test]
    fn test_weighted_formula() {
        // Verify exact weighted calculation
        let result = calculate_overall_score(Some(67.0), Some(85), Some(90));
        // (67 * 0.4) + (85 * 0.4) + (90 * 0.2) = 26.8 + 34.0 + 18.0 = 78.8
        assert_eq!(result.overall_score, Some(78.8));
        assert_eq!(result.color_flag, "yellow"); // skills 67 < 75, so not green
    }

    // ==========================================
    // Story 4b.6: Recommendation Text Tests
    // ==========================================

    #[test]
    fn test_recommendation_green() {
        let rec = generate_recommendation("green", Some(85.0), Some(90), Some(110));
        assert_eq!(
            rec,
            "Strong match. This job aligns well with your skills and the client looks reliable."
        );
    }

    #[test]
    fn test_recommendation_yellow_skills_gap() {
        let rec = generate_recommendation("yellow", Some(60.0), Some(90), Some(100));
        assert!(rec.contains("skills gap"));
        assert!(rec.contains("Proceed with caution"));
    }

    #[test]
    fn test_recommendation_yellow_client() {
        let rec = generate_recommendation("yellow", Some(80.0), Some(70), Some(100));
        assert!(rec.contains("client history"));
        assert!(rec.contains("Proceed with caution"));
    }

    #[test]
    fn test_recommendation_yellow_budget() {
        let rec = generate_recommendation("yellow", Some(80.0), Some(90), Some(85));
        assert!(rec.contains("budget"));
        assert!(rec.contains("Proceed with caution"));
    }

    #[test]
    fn test_recommendation_yellow_multiple_reasons() {
        let rec = generate_recommendation("yellow", Some(60.0), Some(70), Some(85));
        assert!(rec.contains("skills gap"));
        assert!(rec.contains("client history"));
        assert!(rec.contains("budget"));
        assert!(rec.contains(" and "));
    }

    #[test]
    fn test_recommendation_red_zero_hire() {
        let rec = generate_recommendation("red", Some(80.0), Some(45), Some(100));
        assert!(rec.contains("no hire history"));
        assert!(rec.contains("High risk"));
    }

    #[test]
    fn test_recommendation_red_general() {
        let rec = generate_recommendation("red", Some(40.0), Some(50), Some(100));
        assert!(rec.contains("Low priority"));
        assert!(rec.contains("Significant gaps"));
    }

    #[test]
    fn test_recommendation_gray() {
        let rec = generate_recommendation("gray", None, None, None);
        assert!(rec.contains("Insufficient data"));
        assert!(rec.contains("Configure your skills and rates"));
    }
}
