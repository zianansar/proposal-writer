//! Job Queue types for Story 4b.9
//!
//! Types for displaying and managing the job queue with sorting and filtering.
//!
//! Note: tauri-specta type generation deferred to Epic 8 story for build tooling setup.
//! Manual TypeScript type definitions in frontend for now.

use serde::{Deserialize, Serialize};

/// Color classification for job priority
/// Based on component thresholds from Story 4b-5
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScoreColor {
    /// Skills match >= 75 AND client quality >= 80
    Green,
    /// Skills match 50-74 OR client quality 60-79 (not meeting Green or Red)
    Yellow,
    /// Skills match < 50 OR client quality < 60 OR zero-hire client
    Red,
    /// Not yet scored (no skills match baseline)
    Gray,
}

impl ScoreColor {
    /// Convert database string to ScoreColor enum
    pub fn from_db_value(value: &str) -> Self {
        match value {
            "green" => ScoreColor::Green,
            "yellow" => ScoreColor::Yellow,
            "red" => ScoreColor::Red,
            "gray" | _ => ScoreColor::Gray,
        }
    }

    /// Convert ScoreColor enum to database string
    pub fn to_db_value(&self) -> &'static str {
        match self {
            ScoreColor::Green => "green",
            ScoreColor::Yellow => "yellow",
            ScoreColor::Red => "red",
            ScoreColor::Gray => "gray",
        }
    }
}

/// Sort field options for job queue
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortField {
    /// Sort by overall weighted score (highest first)
    Score,
    /// Sort by creation date (newest first)
    Date,
    /// Sort by client name (A-Z)
    ClientName,
}

/// Filter options for job queue
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScoreFilter {
    /// Show all jobs regardless of score
    All,
    /// Show only green-rated jobs
    GreenOnly,
    /// Show yellow and green jobs (hide red/gray)
    YellowAndGreen,
}

/// Job queue item for display
/// AC-1: Displays client name, job title, skills %, client quality %, overall score, color, date
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobQueueItem {
    pub id: i64,
    pub client_name: String,
    pub job_title: String,
    pub skills_match_percent: Option<u8>,
    pub client_quality_percent: Option<u8>,
    pub overall_score: Option<f32>,
    pub score_color: ScoreColor,
    pub created_at: String,
}

/// Color counts for filter chips (AC-5)
/// [AI-Review Fix H2]: Added to show per-filter counts in UI
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ColorCounts {
    pub green: u32,
    pub yellow: u32,
    pub red: u32,
    pub gray: u32,
}

/// Response for job queue queries
/// Includes pagination metadata and color counts for filter chips
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobQueueResponse {
    pub jobs: Vec<JobQueueItem>,
    pub total_count: u32,
    pub has_more: bool,
    /// [AI-Review Fix H2]: Color counts for filter chip labels
    pub color_counts: ColorCounts,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_score_color_from_db_value() {
        assert_eq!(ScoreColor::from_db_value("green"), ScoreColor::Green);
        assert_eq!(ScoreColor::from_db_value("yellow"), ScoreColor::Yellow);
        assert_eq!(ScoreColor::from_db_value("red"), ScoreColor::Red);
        assert_eq!(ScoreColor::from_db_value("gray"), ScoreColor::Gray);
        assert_eq!(ScoreColor::from_db_value("unknown"), ScoreColor::Gray);
    }

    #[test]
    fn test_score_color_to_db_value() {
        assert_eq!(ScoreColor::Green.to_db_value(), "green");
        assert_eq!(ScoreColor::Yellow.to_db_value(), "yellow");
        assert_eq!(ScoreColor::Red.to_db_value(), "red");
        assert_eq!(ScoreColor::Gray.to_db_value(), "gray");
    }

    #[test]
    fn test_score_color_round_trip() {
        // Test that converting to DB and back preserves the value
        let colors = vec![
            ScoreColor::Green,
            ScoreColor::Yellow,
            ScoreColor::Red,
            ScoreColor::Gray,
        ];

        for color in colors {
            let db_value = color.to_db_value();
            let round_trip = ScoreColor::from_db_value(db_value);
            assert_eq!(color, round_trip);
        }
    }
}
