//! Voice profile to prompt instructions builder (Story 5.8)
//!
//! Converts VoiceProfile parameters into natural language instructions for Claude.
//! Instructions are appended to system prompts to match user's calibrated writing style.

use crate::voice::VoiceProfile;

/// Convert VoiceProfile to natural language instructions for Claude
///
/// # Story 5.8: AC-3
/// Generates VOICE CALIBRATION block with:
/// - Tone label derived from tone_score
/// - Sentence length label derived from avg_sentence_length
/// - Structure preferences as percentages
/// - Technical depth label derived from technical_depth
/// - Vocabulary complexity target
/// - Common phrases to incorporate naturally
///
/// # Arguments
/// * `profile` - Voice profile from calibration (Story 5.4/5.7)
///
/// # Returns
/// Formatted voice instructions string ready to append to system prompt
///
/// # Example
/// ```
/// let profile = VoiceProfile { /* ... */ };
/// let instructions = build_voice_instructions(&profile);
/// let full_prompt = format!("{}\n{}", base_prompt, instructions);
/// ```
pub fn build_voice_instructions(profile: &VoiceProfile) -> String {
    // Subtask 1.4: Tone label derivation
    let tone_label = derive_tone_label(profile.tone_score);

    // Subtask 1.5: Technical depth label derivation
    let depth_label = derive_technical_depth_label(profile.technical_depth);

    // Subtask 1.6: Sentence length label derivation
    let length_label = derive_sentence_length_label(profile.avg_sentence_length);

    // Common phrases instruction (optional - only if phrases exist)
    let phrases_instruction = if profile.common_phrases.is_empty() {
        String::new()
    } else {
        // Take top 3 phrases to avoid prompt bloat (AC-3)
        let phrases: Vec<String> = profile
            .common_phrases
            .iter()
            .take(3)
            .map(|p| format!("\"{}\"", p))
            .collect();
        format!(
            "\n- Signature phrases: Naturally incorporate variations of: {}",
            phrases.join(", ")
        )
    };

    // Assemble full voice calibration block (AC-3 format)
    format!(
        r#"
VOICE CALIBRATION (match the user's natural writing style):
- Tone: Write in a {} tone (calibrated score: {:.1}/10)
- Sentence length: Use {} sentences (target avg: {:.0} words)
- Structure: Mix paragraphs {}% and bullet points {}%
- Technical depth: {} (calibrated: {:.1}/10)
- Vocabulary: Target Flesch-Kincaid grade level {:.1}{}
"#,
        tone_label,
        profile.tone_score,
        length_label,
        profile.avg_sentence_length,
        profile.structure_preference.paragraphs_pct,
        profile.structure_preference.bullets_pct,
        depth_label,
        profile.technical_depth,
        profile.vocabulary_complexity,
        phrases_instruction
    )
}

/// Derive tone label from tone_score (Subtask 1.4)
///
/// # Story 5.8: AC-3
/// Mapping:
/// - 1-3: "casual and conversational"
/// - 4-6: "balanced (professional yet approachable)"
/// - 7-10: "professional and formal"
///
/// # Test Boundary Values
/// - 3 → casual
/// - 4 → balanced
/// - 6 → balanced
/// - 7 → professional
fn derive_tone_label(tone_score: f32) -> &'static str {
    match tone_score as u8 {
        1..=3 => "casual and conversational",
        4..=6 => "balanced (professional yet approachable)",
        7..=10 => "professional and formal",
        _ => "balanced (professional yet approachable)", // Fallback for out-of-range values
    }
}

/// Derive technical depth label from technical_depth (Subtask 1.5)
///
/// # Story 5.8: AC-3
/// Mapping:
/// - 1-3: "layman (avoid jargon, explain concepts simply)"
/// - 4-6: "intermediate (some technical terms are fine)"
/// - 7-10: "expert (use domain terminology freely)"
///
/// # Test Boundary Values
/// - 3 → layman
/// - 4 → intermediate
/// - 6 → intermediate
/// - 7 → expert
fn derive_technical_depth_label(technical_depth: f32) -> &'static str {
    match technical_depth as u8 {
        1..=3 => "layman (avoid jargon, explain concepts simply)",
        4..=6 => "intermediate (some technical terms are fine)",
        7..=10 => "expert (use domain terminology freely)",
        _ => "intermediate (some technical terms are fine)", // Fallback
    }
}

/// Derive sentence length label from avg_sentence_length (Subtask 1.6)
///
/// # Story 5.8: AC-3
/// Mapping:
/// - 0-12 words: "short"
/// - 13-20 words: "moderate"
/// - 21+ words: "longer"
///
/// # Test Boundary Values
/// - 12 → short
/// - 13 → moderate
/// - 20 → moderate
/// - 21 → longer
fn derive_sentence_length_label(avg_sentence_length: f32) -> &'static str {
    match avg_sentence_length as u8 {
        0..=12 => "short",
        13..=20 => "moderate",
        _ => "longer", // 21+
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::voice::{CalibrationSource, StructurePreference};

    /// Helper: Create test profile with all fields
    fn create_test_profile() -> VoiceProfile {
        VoiceProfile {
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
                "Let's collaborate".to_string(),
                "fourth phrase".to_string(),
                "fifth phrase".to_string(),
            ],
            sample_count: 5,
            calibration_source: CalibrationSource::GoldenSet,
        }
    }

    // Subtask 6.1: Test build_voice_instructions output format
    #[test]
    fn test_build_voice_instructions_output_format() {
        let profile = create_test_profile();
        let instructions = build_voice_instructions(&profile);

        // Verify required sections exist
        assert!(
            instructions.contains("VOICE CALIBRATION"),
            "Should have VOICE CALIBRATION header"
        );
        assert!(
            instructions.contains("- Tone:"),
            "Should include tone instruction"
        );
        assert!(
            instructions.contains("- Sentence length:"),
            "Should include sentence length instruction"
        );
        assert!(
            instructions.contains("- Structure:"),
            "Should include structure instruction"
        );
        assert!(
            instructions.contains("- Technical depth:"),
            "Should include technical depth instruction"
        );
        assert!(
            instructions.contains("- Vocabulary:"),
            "Should include vocabulary instruction"
        );
        assert!(
            instructions.contains("- Signature phrases:"),
            "Should include phrases when common_phrases not empty"
        );

        // Verify numeric values interpolated
        assert!(instructions.contains("6.5/10"), "Should show tone_score");
        assert!(
            instructions.contains("15 words"),
            "Should show avg_sentence_length"
        );
        assert!(
            instructions.contains("paragraphs 70%"),
            "Should show paragraph percentage"
        );
        assert!(
            instructions.contains("bullet points 30%"),
            "Should show bullet percentage"
        );
        assert!(
            instructions.contains("7.5/10"),
            "Should show technical_depth score"
        );
        assert!(
            instructions.contains("grade level 9.8"),
            "Should show vocabulary_complexity"
        );
    }

    // Subtask 6.2: Test tone label derivation at boundary values (3, 4, 6, 7)
    #[test]
    fn test_tone_label_at_boundaries() {
        // Boundary: 3 → casual
        assert_eq!(
            derive_tone_label(3.0),
            "casual and conversational",
            "tone_score 3.0 should be casual"
        );

        // Boundary: 4 → balanced (transition)
        assert_eq!(
            derive_tone_label(4.0),
            "balanced (professional yet approachable)",
            "tone_score 4.0 should be balanced"
        );

        // Boundary: 6 → balanced
        assert_eq!(
            derive_tone_label(6.0),
            "balanced (professional yet approachable)",
            "tone_score 6.0 should be balanced"
        );

        // Boundary: 7 → professional (transition)
        assert_eq!(
            derive_tone_label(7.0),
            "professional and formal",
            "tone_score 7.0 should be professional"
        );

        // Edge cases
        assert_eq!(
            derive_tone_label(1.0),
            "casual and conversational",
            "tone_score 1.0 should be casual"
        );
        assert_eq!(
            derive_tone_label(10.0),
            "professional and formal",
            "tone_score 10.0 should be professional"
        );
    }

    // Subtask 6.2: Test tone label full range
    #[test]
    fn test_tone_label_full_range() {
        // Casual range (1-3)
        assert_eq!(
            derive_tone_label(2.0),
            "casual and conversational",
            "tone_score 2.0 should be casual"
        );

        // Balanced range (4-6)
        assert_eq!(
            derive_tone_label(5.0),
            "balanced (professional yet approachable)",
            "tone_score 5.0 should be balanced"
        );

        // Professional range (7-10)
        assert_eq!(
            derive_tone_label(8.5),
            "professional and formal",
            "tone_score 8.5 should be professional"
        );
    }

    // L2 fix: Test edge case tone_score = 0 and out-of-range values
    #[test]
    fn test_label_derivation_edge_cases() {
        // Edge case: tone_score = 0 (below valid range, should fallback)
        assert_eq!(
            derive_tone_label(0.0),
            "balanced (professional yet approachable)",
            "tone_score 0.0 should fallback to balanced"
        );

        // Edge case: technical_depth = 0 (below valid range, should fallback)
        assert_eq!(
            derive_technical_depth_label(0.0),
            "intermediate (some technical terms are fine)",
            "technical_depth 0.0 should fallback to intermediate"
        );

        // Edge case: negative values (invalid, should fallback)
        assert_eq!(
            derive_tone_label(-1.0),
            "balanced (professional yet approachable)",
            "negative tone_score should fallback to balanced"
        );

        // Edge case: values > 10 (above valid range, should fallback)
        assert_eq!(
            derive_tone_label(15.0),
            "balanced (professional yet approachable)",
            "tone_score > 10 should fallback to balanced"
        );

        // Edge case: sentence length = 0
        assert_eq!(
            derive_sentence_length_label(0.0),
            "short",
            "avg_sentence_length 0 should be short"
        );
    }

    // Subtask 6.3: Test technical depth label derivation at boundaries
    #[test]
    fn test_technical_depth_label_at_boundaries() {
        // Boundary: 3 → layman
        assert_eq!(
            derive_technical_depth_label(3.0),
            "layman (avoid jargon, explain concepts simply)",
            "technical_depth 3.0 should be layman"
        );

        // Boundary: 4 → intermediate (transition)
        assert_eq!(
            derive_technical_depth_label(4.0),
            "intermediate (some technical terms are fine)",
            "technical_depth 4.0 should be intermediate"
        );

        // Boundary: 6 → intermediate
        assert_eq!(
            derive_technical_depth_label(6.0),
            "intermediate (some technical terms are fine)",
            "technical_depth 6.0 should be intermediate"
        );

        // Boundary: 7 → expert (transition)
        assert_eq!(
            derive_technical_depth_label(7.0),
            "expert (use domain terminology freely)",
            "technical_depth 7.0 should be expert"
        );

        // Edge cases
        assert_eq!(
            derive_technical_depth_label(1.0),
            "layman (avoid jargon, explain concepts simply)",
            "technical_depth 1.0 should be layman"
        );
        assert_eq!(
            derive_technical_depth_label(10.0),
            "expert (use domain terminology freely)",
            "technical_depth 10.0 should be expert"
        );
    }

    // Subtask 6.4: Test sentence length label derivation
    #[test]
    fn test_sentence_length_label_derivation() {
        // Boundary: 12 → short
        assert_eq!(
            derive_sentence_length_label(12.0),
            "short",
            "12 words should be short"
        );

        // Boundary: 13 → moderate (transition)
        assert_eq!(
            derive_sentence_length_label(13.0),
            "moderate",
            "13 words should be moderate"
        );

        // Boundary: 20 → moderate
        assert_eq!(
            derive_sentence_length_label(20.0),
            "moderate",
            "20 words should be moderate"
        );

        // Boundary: 21 → longer (transition)
        assert_eq!(
            derive_sentence_length_label(21.0),
            "longer",
            "21 words should be longer"
        );

        // Edge cases
        assert_eq!(
            derive_sentence_length_label(5.0),
            "short",
            "5 words should be short"
        );
        assert_eq!(
            derive_sentence_length_label(15.0),
            "moderate",
            "15 words should be moderate"
        );
        assert_eq!(
            derive_sentence_length_label(30.0),
            "longer",
            "30 words should be longer"
        );
    }

    // Subtask 6.1: Test empty common_phrases → no phrase line
    #[test]
    fn test_empty_common_phrases_no_phrase_line() {
        let mut profile = create_test_profile();
        profile.common_phrases = vec![];

        let instructions = build_voice_instructions(&profile);

        assert!(
            !instructions.contains("- Signature phrases:"),
            "Should NOT include phrase line when common_phrases is empty"
        );
    }

    // Subtask 6.1: Test 5 common_phrases → only top 3 included
    #[test]
    fn test_five_common_phrases_only_top_three_included() {
        let profile = create_test_profile(); // Has 5 phrases

        let instructions = build_voice_instructions(&profile);

        // Verify first 3 phrases included
        assert!(
            instructions.contains("I have experience with"),
            "Should include first phrase"
        );
        assert!(
            instructions.contains("happy to help you"),
            "Should include second phrase"
        );
        assert!(
            instructions.contains("Let's collaborate"),
            "Should include third phrase"
        );

        // Verify 4th and 5th phrases NOT included
        assert!(
            !instructions.contains("fourth phrase"),
            "Should NOT include fourth phrase"
        );
        assert!(
            !instructions.contains("fifth phrase"),
            "Should NOT include fifth phrase"
        );
    }

    // Subtask 6.2: Test with casual tone (tone_score 2)
    #[test]
    fn test_casual_tone_generation() {
        let mut profile = create_test_profile();
        profile.tone_score = 2.0;

        let instructions = build_voice_instructions(&profile);

        assert!(
            instructions.contains("casual and conversational"),
            "Should derive casual tone label"
        );
        assert!(
            instructions.contains("2.0/10"),
            "Should show calibrated tone_score"
        );
    }

    // Subtask 6.3: Test with expert technical depth
    #[test]
    fn test_expert_technical_depth_generation() {
        let mut profile = create_test_profile();
        profile.technical_depth = 9.0;

        let instructions = build_voice_instructions(&profile);

        assert!(
            instructions.contains("expert (use domain terminology freely)"),
            "Should derive expert depth label"
        );
        assert!(
            instructions.contains("9.0/10"),
            "Should show calibrated technical_depth"
        );
    }

    // Subtask 6.4: Test with short sentences
    #[test]
    fn test_short_sentences_generation() {
        let mut profile = create_test_profile();
        profile.avg_sentence_length = 10.0;

        let instructions = build_voice_instructions(&profile);

        assert!(
            instructions.contains("short sentences"),
            "Should derive short sentence label"
        );
        assert!(
            instructions.contains("10 words"),
            "Should show target avg sentence length"
        );
    }

    // Integration test: Full profile to instructions
    #[test]
    fn test_full_profile_to_instructions_integration() {
        let profile = VoiceProfile {
            tone_score: 8.0,
            avg_sentence_length: 18.0,
            vocabulary_complexity: 12.5,
            structure_preference: StructurePreference {
                paragraphs_pct: 60,
                bullets_pct: 40,
            },
            technical_depth: 5.5,
            length_preference: 5.0,
            common_phrases: vec!["looking forward to working".to_string()],
            sample_count: 10,
            calibration_source: CalibrationSource::QuickCalibration,
        };

        let instructions = build_voice_instructions(&profile);

        // Verify all derived labels
        assert!(instructions.contains("professional and formal"));
        assert!(instructions.contains("moderate sentences"));
        assert!(instructions.contains("intermediate (some technical terms are fine)"));
        assert!(instructions.contains("paragraphs 60%"));
        assert!(instructions.contains("bullet points 40%"));
        assert!(instructions.contains("grade level 12.5"));
        assert!(instructions.contains("looking forward to working"));
    }
}
