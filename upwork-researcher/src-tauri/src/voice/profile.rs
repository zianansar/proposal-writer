//! Voice profile data structures for Epic 5
//!
//! Defines VoiceProfile struct and related types.
//! Story 5.4: Task 2 - VoiceProfile struct and analysis aggregation

use serde::{Deserialize, Serialize};

/// Voice profile extracted from Golden Set proposals
///
/// # Story 5.4: AC-2
/// Extracted parameters:
/// - Tone Score (1-10: casual to formal)
/// - Average Sentence Length (words per sentence)
/// - Vocabulary Complexity (Flesch-Kincaid grade level)
/// - Structure Preference (paragraphs vs bullets percentage)
/// - Technical Depth (1-10: layman to expert)
/// - Common Phrases (top 5 repeated 3+ word phrases)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceProfile {
    /// Tone: 1 (very casual) to 10 (very formal)
    pub tone_score: f32,

    /// Average words per sentence
    pub avg_sentence_length: f32,

    /// Flesch-Kincaid grade level (1-16)
    pub vocabulary_complexity: f32,

    /// Structure preference as percentages
    pub structure_preference: StructurePreference,

    /// Technical depth: 1 (layman) to 10 (expert)
    pub technical_depth: f32,

    /// Length preference: 1 (brief) to 10 (detailed)
    /// Story 6.2: Manual voice parameter adjustments
    pub length_preference: f32,

    /// Top repeated phrases (3+ words, appearing 2+ times)
    pub common_phrases: Vec<String>,

    /// Number of proposals analyzed
    pub sample_count: u32,

    /// Calibration source
    pub calibration_source: CalibrationSource,
}

/// Structure preference breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructurePreference {
    /// Percentage using paragraphs (0-100)
    pub paragraphs_pct: u8,

    /// Percentage using bullets (0-100)
    pub bullets_pct: u8,
}

/// Source of voice calibration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalibrationSource {
    /// Calibrated from Golden Set proposals (Story 5.4)
    GoldenSet,

    /// Quick Calibration from single proposal (Story 5.7)
    QuickCalibration,

    /// Future: Implicit learning from edit patterns
    Implicit,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_voice_profile_serde() {
        // Task 2.4: Test serde derives for JSON serialization
        let profile = VoiceProfile {
            tone_score: 6.5,
            avg_sentence_length: 15.2,
            vocabulary_complexity: 9.8,
            structure_preference: StructurePreference {
                paragraphs_pct: 70,
                bullets_pct: 30,
            },
            technical_depth: 7.5,
            length_preference: 5.0,
            common_phrases: vec![
                "I have experience with".to_string(),
                "happy to help you".to_string(),
            ],
            sample_count: 5,
            calibration_source: CalibrationSource::GoldenSet,
        };

        // Serialize to JSON
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("tone_score"));
        assert!(json.contains("6.5"));

        // Deserialize back
        let deserialized: VoiceProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.tone_score, 6.5);
        assert_eq!(deserialized.sample_count, 5);
    }
}
