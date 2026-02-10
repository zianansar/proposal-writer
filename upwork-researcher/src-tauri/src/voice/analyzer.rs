//! Text analysis algorithms for voice calibration
//!
//! Story 5.4: Task 1 - Implement text analysis module in Rust
//! All analysis happens locally - NO API calls (AR-12)

use crate::voice::profile::{CalibrationSource, StructurePreference, VoiceProfile};
use std::collections::HashMap;

/// Segment text into sentences, handling common abbreviations
///
/// # Story 5.4: Task 1.2 - Sentence segmentation
fn segment_sentences(text: &str) -> Vec<String> {
    // Common abbreviations that don't end sentences
    let abbrevs = [
        "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "vs", "etc", "i.e", "e.g", "Inc", "Ltd",
        "Corp", "Co",
    ];

    let mut sentences = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = text.chars().collect();

    for (i, &ch) in chars.iter().enumerate() {
        current.push(ch);

        // Check if we hit sentence-ending punctuation
        if ch == '.' || ch == '!' || ch == '?' {
            // Check if next char is also punctuation (skip if so)
            let is_followed_by_punct = i + 1 < chars.len()
                && (chars[i + 1] == '.' || chars[i + 1] == '!' || chars[i + 1] == '?');

            if is_followed_by_punct {
                // Skip - wait for last punctuation in sequence
                continue;
            }

            let trimmed = current.trim();

            // Check if it's an abbreviation
            let words: Vec<&str> = trimmed.split_whitespace().collect();
            if let Some(last_word) = words.last() {
                let last_word_no_punct = last_word.trim_end_matches(|c| c == '.' || c == '!' || c == '?');
                let is_abbreviation = abbrevs.iter().any(|&abbrev| last_word_no_punct == abbrev);

                if !is_abbreviation {
                    // Real sentence ending
                    sentences.push(trimmed.to_string());
                    current.clear();
                }
            }
        }
    }

    // Add any remaining text
    if !current.trim().is_empty() {
        sentences.push(current.trim().to_string());
    }

    // Filter empty
    sentences.into_iter().filter(|s| !s.is_empty()).collect()
}

/// Calculate average sentence length in words
///
/// # Story 5.4: Task 1.3 - Average sentence length calculation
fn calculate_avg_sentence_length(sentences: &[String]) -> f32 {
    if sentences.is_empty() {
        return 0.0;
    }

    let total_words: usize = sentences
        .iter()
        .map(|s| s.split_whitespace().count())
        .sum();

    total_words as f32 / sentences.len() as f32
}

/// Count syllables in a word (simplified heuristic)
///
/// # Story 5.4: Task 1.4 - Supporting function for Flesch-Kincaid
fn count_syllables(word: &str) -> usize {
    if word.is_empty() {
        return 0;
    }

    let word_lower = word.to_lowercase();
    let chars: Vec<char> = word_lower.chars().collect();
    let vowels = ['a', 'e', 'i', 'o', 'u', 'y'];

    let mut syllable_count = 0;
    let mut prev_was_vowel = false;

    for (i, &ch) in chars.iter().enumerate() {
        let is_vowel = if ch == 'y' {
            // 'y' is a vowel only if not at the beginning
            i > 0
        } else {
            vowels.contains(&ch)
        };

        if is_vowel {
            if !prev_was_vowel {
                syllable_count += 1;
            }
            prev_was_vowel = true;
        } else {
            prev_was_vowel = false;
        }
    }

    // Handle silent 'e' at end
    if chars.len() >= 2 && chars[chars.len() - 1] == 'e' && syllable_count > 1 {
        let second_last = chars[chars.len() - 2];

        // Exception: words ending in "le" preceded by consonant (apple, table, simple)
        // The 'le' forms its own syllable, so don't subtract
        if second_last == 'l' && chars.len() >= 3 {
            let third_last = chars[chars.len() - 3];
            let basic_vowels = ['a', 'e', 'i', 'o', 'u'];
            if !basic_vowels.contains(&third_last) {
                // Don't subtract - "le" is its own syllable
                return syllable_count.max(1);
            }
        }

        // Check if the 'e' is part of a vowel group (like "tree", "free")
        if second_last != 'a' && second_last != 'e' && second_last != 'i'
            && second_last != 'o' && second_last != 'u'
        {
            syllable_count -= 1;
        }
    }

    // Every word has at least 1 syllable
    syllable_count.max(1)
}

/// Calculate Flesch-Kincaid grade level
///
/// # Story 5.4: Task 1.4 - Vocabulary complexity calculation
/// Formula: FK Grade = 0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
fn calculate_flesch_kincaid(text: &str) -> f32 {
    let sentences = segment_sentences(text);
    if sentences.is_empty() {
        return 1.0;
    }

    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return 1.0;
    }

    let total_syllables: usize = words.iter().map(|w| count_syllables(w)).sum();

    let words_per_sentence = words.len() as f32 / sentences.len() as f32;
    let syllables_per_word = total_syllables as f32 / words.len() as f32;

    let grade = 0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59;

    // Clamp to 1-16 range
    grade.max(1.0).min(16.0)
}

/// Calculate tone/formality score (1=casual, 10=formal)
///
/// # Story 5.4: Task 1.5 - Tone scoring based on formal word ratio
fn calculate_tone_score(text: &str) -> f32 {
    let formal_markers = [
        "therefore",
        "consequently",
        "furthermore",
        "moreover",
        "nevertheless",
        "however",
        "regarding",
        "pursuant",
        "hereby",
        "wherein",
        "thereof",
        "aforementioned",
        "notwithstanding",
        "accordingly",
    ];

    let casual_markers = [
        "hey",
        "gonna",
        "wanna",
        "stuff",
        "things",
        "awesome",
        "cool",
        "great",
        "yeah",
        "yep",
        "nope",
        "kinda",
        "sorta",
        "lots",
        "tons",
    ];

    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return 5.0; // Default mid-tone
    }

    let word_lower: Vec<String> = words.iter().map(|w| w.to_lowercase()).collect();

    let formal_count = word_lower
        .iter()
        .filter(|w| formal_markers.iter().any(|&m| w.contains(m)))
        .count();

    let casual_count = word_lower
        .iter()
        .filter(|w| casual_markers.iter().any(|&m| w.contains(m)))
        .count();

    // Also check for contractions (casual indicator)
    let contraction_count = words.iter().filter(|w| w.contains('\'')). count();

    // Calculate formality ratio
    let total_markers = formal_count + casual_count + contraction_count;
    if total_markers == 0 {
        return 5.0; // Neutral
    }

    let formality_ratio =
        (formal_count as f32 - casual_count as f32 - contraction_count as f32) / total_markers as f32;

    // Scale to 1-10 (negative ratio = casual, positive = formal)
    let score = 5.0 + (formality_ratio * 5.0);
    score.max(1.0).min(10.0)
}

/// Detect structure preference (bullets vs paragraphs)
///
/// # Story 5.4: Task 1.6 - Structure detection
fn detect_structure(text: &str) -> StructurePreference {
    let lines: Vec<&str> = text.lines().collect();
    if lines.is_empty() {
        return StructurePreference {
            paragraphs_pct: 100,
            bullets_pct: 0,
        };
    }

    let bullet_patterns = ["-", "•", "*", "→", "1.", "2.", "3.", "4.", "5."];

    let bullet_lines = lines
        .iter()
        .filter(|l| {
            let trimmed = l.trim();
            bullet_patterns.iter().any(|&p| trimmed.starts_with(p))
        })
        .count();

    let total_content_lines = lines.iter().filter(|l| !l.trim().is_empty()).count();

    if total_content_lines == 0 {
        return StructurePreference {
            paragraphs_pct: 100,
            bullets_pct: 0,
        };
    }

    let bullets_pct = ((bullet_lines as f32 / total_content_lines as f32) * 100.0) as u8;

    StructurePreference {
        paragraphs_pct: 100 - bullets_pct,
        bullets_pct,
    }
}

/// Calculate technical depth score (1=layman, 10=expert)
///
/// # Story 5.4: Task 1.7 - Technical depth detection
fn calculate_technical_depth(text: &str) -> f32 {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return 1.0;
    }

    let mut technical_count = 0;

    for word in &words {
        let word_lower = word.to_lowercase();

        // Check for acronyms (all caps, 2+ letters)
        if word.len() >= 2 && word.chars().all(|c| c.is_uppercase() || !c.is_alphabetic()) {
            technical_count += 1;
            continue;
        }

        // Check for technical/programming terms
        let tech_terms = [
            "api", "database", "framework", "algorithm", "implementation", "architecture", "backend",
            "frontend", "deployment", "integration", "optimization", "authentication", "encryption",
            "server", "client", "protocol", "interface", "repository", "pipeline", "infrastructure",
        ];

        if tech_terms.iter().any(|&term| word_lower.contains(term)) {
            technical_count += 1;
        }
    }

    // Calculate ratio and scale to 1-10
    let ratio = technical_count as f32 / words.len() as f32;
    let score = (ratio * 100.0).min(10.0).max(1.0);
    score
}

/// Extract common phrases (n-grams appearing multiple times)
///
/// # Story 5.4: Task 1.8 - Common phrase extraction
fn extract_common_phrases(text: &str) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() < 3 {
        return Vec::new();
    }

    let mut phrase_counts: HashMap<String, usize> = HashMap::new();

    // Extract 3-grams, 4-grams, 5-grams
    for n in 3..=5 {
        if words.len() < n {
            continue;
        }

        for window in words.windows(n) {
            let phrase = window.join(" ").to_lowercase();
            *phrase_counts.entry(phrase).or_insert(0) += 1;
        }
    }

    // Filter phrases appearing 2+ times and sort by frequency
    let mut common: Vec<(String, usize)> = phrase_counts
        .into_iter()
        .filter(|(_, count)| *count >= 2)
        .collect();

    common.sort_by(|a, b| b.1.cmp(&a.1));

    // Return top 5 phrases
    common
        .into_iter()
        .take(5)
        .map(|(phrase, _)| phrase)
        .collect()
}

/// Analyze a single proposal and extract voice parameters
///
/// # Story 5.4: Task 2.2 - Analyze single proposal
pub fn analyze_single_proposal(text: &str) -> VoiceProfile {
    let sentences = segment_sentences(text);

    VoiceProfile {
        tone_score: calculate_tone_score(text),
        avg_sentence_length: calculate_avg_sentence_length(&sentences),
        vocabulary_complexity: calculate_flesch_kincaid(text),
        structure_preference: detect_structure(text),
        technical_depth: calculate_technical_depth(text),
        length_preference: 5.0, // Story 6.2: Manual adjustment, default to balanced
        common_phrases: extract_common_phrases(text),
        sample_count: 1,
        calibration_source: CalibrationSource::GoldenSet,
    }
}

/// Aggregate voice profiles from multiple proposals
///
/// # Story 5.4: Task 2.3 - Aggregate voice profile across proposals
pub fn aggregate_voice_profile(proposals: &[String]) -> VoiceProfile {
    if proposals.is_empty() {
        // Return default profile
        return VoiceProfile {
            tone_score: 5.0,
            avg_sentence_length: 15.0,
            vocabulary_complexity: 8.0,
            structure_preference: StructurePreference {
                paragraphs_pct: 80,
                bullets_pct: 20,
            },
            technical_depth: 5.0,
            length_preference: 5.0, // Story 6.2: Manual adjustment, default to balanced
            common_phrases: Vec::new(),
            sample_count: 0,
            calibration_source: CalibrationSource::GoldenSet,
        };
    }

    // Analyze each proposal
    let individual_profiles: Vec<VoiceProfile> = proposals
        .iter()
        .map(|p| analyze_single_proposal(p))
        .collect();

    // Average numeric scores
    let tone_score = individual_profiles
        .iter()
        .map(|p| p.tone_score)
        .sum::<f32>()
        / proposals.len() as f32;

    let avg_sentence_length = individual_profiles
        .iter()
        .map(|p| p.avg_sentence_length)
        .sum::<f32>()
        / proposals.len() as f32;

    let vocabulary_complexity = individual_profiles
        .iter()
        .map(|p| p.vocabulary_complexity)
        .sum::<f32>()
        / proposals.len() as f32;

    let technical_depth = individual_profiles
        .iter()
        .map(|p| p.technical_depth)
        .sum::<f32>()
        / proposals.len() as f32;

    // Average structure preferences
    let avg_paragraphs_pct = individual_profiles
        .iter()
        .map(|p| p.structure_preference.paragraphs_pct as f32)
        .sum::<f32>()
        / proposals.len() as f32;

    let avg_bullets_pct = individual_profiles
        .iter()
        .map(|p| p.structure_preference.bullets_pct as f32)
        .sum::<f32>()
        / proposals.len() as f32;

    // Merge common phrases (flatten all phrases, re-count, take top 5)
    let all_text = proposals.join(" ");
    let merged_phrases = extract_common_phrases(&all_text);

    VoiceProfile {
        tone_score,
        avg_sentence_length,
        vocabulary_complexity,
        structure_preference: StructurePreference {
            paragraphs_pct: avg_paragraphs_pct as u8,
            bullets_pct: avg_bullets_pct as u8,
        },
        technical_depth,
        length_preference: 5.0, // Story 6.2: Manual adjustment, default to balanced
        common_phrases: merged_phrases,
        sample_count: proposals.len() as u32,
        calibration_source: CalibrationSource::GoldenSet,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_segment_sentences_basic() {
        // Story 5.4: Task 5.1 - Test sentence segmentation edge cases
        let text = "Hello. How are you?";
        let sentences = segment_sentences(text);
        assert_eq!(sentences.len(), 2);
        assert_eq!(sentences[0], "Hello.");
        assert_eq!(sentences[1], "How are you?");
    }

    #[test]
    fn test_segment_sentences_abbreviation() {
        // Story 5.4: Task 5.1 - Abbreviation handling
        let text = "Dr. Smith went home.";
        let sentences = segment_sentences(text);
        assert_eq!(sentences.len(), 1);
    }

    #[test]
    fn test_segment_sentences_multiple_punctuation() {
        // Story 5.4: Task 5.1 - Multiple punctuation
        let text = "What?! No way.";
        let sentences = segment_sentences(text);
        assert_eq!(sentences.len(), 2);
    }

    #[test]
    fn test_avg_sentence_length() {
        // Story 5.4: Task 1.3 - Average sentence length
        let sentences = vec!["Hello world.".to_string(), "How are you today?".to_string()];
        let avg = calculate_avg_sentence_length(&sentences);
        // First: 2 words, Second: 4 words → avg = 3.0
        assert_eq!(avg, 3.0);
    }

    #[test]
    fn test_count_syllables() {
        // Story 5.4: Task 1.4 - Syllable counting
        assert_eq!(count_syllables("cat"), 1);
        assert_eq!(count_syllables("apple"), 2);
        assert_eq!(count_syllables("beautiful"), 3);
        assert_eq!(count_syllables("university"), 5);
    }

    #[test]
    fn test_flesch_kincaid_simple() {
        // Story 5.4: Task 5.2 - FK calculation accuracy
        let text = "The cat sat on the mat.";
        let grade = calculate_flesch_kincaid(text);
        // Simple text should have low grade level (1-3)
        assert!(grade >= 1.0 && grade <= 4.0, "Grade: {}", grade);
    }

    #[test]
    fn test_flesch_kincaid_complex() {
        // Story 5.4: Task 5.2 - Complex text
        let text = "The implementation of sophisticated algorithmic paradigms necessitates comprehensive architectural considerations.";
        let grade = calculate_flesch_kincaid(text);
        // Complex text should have high grade level (10+)
        assert!(grade >= 10.0, "Grade: {}", grade);
    }

    #[test]
    fn test_tone_score_casual() {
        // Story 5.4: Task 5.3 - Casual text tone
        let text = "Hey, that's awesome! Yeah, I'm gonna help you with this stuff.";
        let score = calculate_tone_score(text);
        // Should be casual (1-4)
        assert!(score >= 1.0 && score <= 5.0, "Tone: {}", score);
    }

    #[test]
    fn test_tone_score_formal() {
        // Story 5.4: Task 5.3 - Formal text tone
        let text = "Therefore, I shall consequently provide furthermore detailed analysis regarding the aforementioned subject.";
        let score = calculate_tone_score(text);
        // Should be formal (6-10)
        assert!(score >= 6.0 && score <= 10.0, "Tone: {}", score);
    }

    #[test]
    fn test_structure_paragraphs() {
        // Story 5.4: Task 5.4 - All-paragraph text
        let text = "This is a paragraph.\nThis is another paragraph.\nAnd one more.";
        let structure = detect_structure(text);
        assert_eq!(structure.paragraphs_pct, 100);
        assert_eq!(structure.bullets_pct, 0);
    }

    #[test]
    fn test_structure_bullets() {
        // Story 5.4: Task 5.4 - Bulleted list
        let text = "- First item\n- Second item\n- Third item";
        let structure = detect_structure(text);
        assert!(structure.bullets_pct >= 90, "Bullets: {}", structure.bullets_pct);
    }

    #[test]
    fn test_technical_depth() {
        // Story 5.4: Task 1.7 - Technical terms
        let tech_text = "API integration with database backend using authentication protocol";
        let score = calculate_technical_depth(tech_text);
        assert!(score >= 5.0, "Technical depth: {}", score);

        let simple_text = "I like to walk in the park";
        let score2 = calculate_technical_depth(simple_text);
        assert!(score2 <= 3.0, "Simple text depth: {}", score2);
    }

    #[test]
    fn test_extract_common_phrases() {
        // Story 5.4: Task 1.8 - Common phrase extraction
        let text = "I have experience with React. I have experience with Vue. I love working on projects.";
        let phrases = extract_common_phrases(text);
        assert!(!phrases.is_empty());
        assert!(phrases.iter().any(|p| p.contains("i have experience")));
    }

    #[test]
    fn test_aggregate_voice_profile() {
        // Story 5.4: Task 5.5 - Aggregation of multiple proposals
        let proposals = vec![
            "Hello. This is a test.".to_string(),
            "Another test. How are you?".to_string(),
            "Final test. Goodbye.".to_string(),
        ];

        let profile = aggregate_voice_profile(&proposals);
        assert_eq!(profile.sample_count, 3);
        assert!(profile.tone_score >= 1.0 && profile.tone_score <= 10.0);
        assert!(profile.avg_sentence_length > 0.0);
    }

    #[test]
    fn test_performance_target() {
        // Story 5.4: Task 5.6 - Performance (<2s for 5 proposals of 500 words)
        use std::time::Instant;

        // Generate 5 sample proposals of ~500 words each
        let sample_proposal = "Lorem ipsum dolor sit amet ".repeat(70); // ~500 words
        let proposals: Vec<String> = (0..5).map(|_| sample_proposal.clone()).collect();

        let start = Instant::now();
        let _ = aggregate_voice_profile(&proposals);
        let elapsed = start.elapsed();

        assert!(
            elapsed.as_secs_f32() < 2.0,
            "Analysis took {:.2}s, exceeds 2s target",
            elapsed.as_secs_f32()
        );
    }
}
