//! Humanization module for AI detection prevention (Story 3.3).
//!
//! Provides prompt engineering to inject natural imperfections into AI-generated
//! proposals. Uses intensity-based prompt modifiers (Off/Light/Medium/Heavy)
//! appended to the system prompt in a single API call (zero latency overhead).
//!
//! ## Architecture
//! - FR-7: Natural imperfections injection during generation (NOT post-processing)
//! - AR-8: Anthropic Claude API integration
//! - NFR-6: <8s generation time (humanization adds 0ms — single API call)
//! - NFR-15: Professional quality maintained

use serde::{Deserialize, Serialize};

// ============================================================================
// Humanization Intensity
// ============================================================================

/// Humanization intensity levels controlling the frequency and type of
/// natural imperfections injected into generated proposals.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HumanizationIntensity {
    /// No humanization — pure AI output
    Off,
    /// Subtle: ~0.5-1 humanization elements per 100 words
    Light,
    /// Recommended default: ~1-2 elements per 100 words
    Medium,
    /// Casual: ~2-3 elements per 100 words
    Heavy,
}

impl HumanizationIntensity {
    /// Parse intensity from a string value (case-insensitive).
    pub fn from_str_value(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "off" => Ok(Self::Off),
            "light" => Ok(Self::Light),
            "medium" => Ok(Self::Medium),
            "heavy" => Ok(Self::Heavy),
            other => Err(format!(
                "Invalid humanization intensity '{}'. Valid values: off, light, medium, heavy",
                other
            )),
        }
    }

    /// Return the string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::Light => "light",
            Self::Medium => "medium",
            Self::Heavy => "heavy",
        }
    }

    /// Check if a string is a valid intensity value.
    pub fn is_valid(s: &str) -> bool {
        Self::from_str_value(s).is_ok()
    }

    /// Rate description for display.
    pub fn rate_description(&self) -> &'static str {
        match self {
            Self::Off => "No humanization",
            Self::Light => "0.5-1 touches per 100 words",
            Self::Medium => "1-2 touches per 100 words",
            Self::Heavy => "2-3 touches per 100 words",
        }
    }

    /// Escalate to the next higher intensity level for re-humanization (Story 3.4).
    ///
    /// Returns the escalated intensity or an error if already at maximum.
    ///
    /// Escalation path: Off → Light → Medium → Heavy → Error
    pub fn escalate(&self) -> Result<Self, String> {
        match self {
            Self::Off => Ok(Self::Light),
            Self::Light => Ok(Self::Medium),
            Self::Medium => Ok(Self::Heavy),
            Self::Heavy => Err(
                "Already at maximum intensity (Heavy). Consider manual editing.".to_string()
            ),
        }
    }
}

// ============================================================================
// AI Tells — words/phrases that signal AI-generated text
// ============================================================================

/// Words that research identifies as strong AI-writing signals.
/// These are flagged by detection tools (GPTZero, Perplexity, etc.)
pub const AI_TELLS: &[&str] = &[
    "delve",
    "leverage",
    "utilize",
    "robust",
    "multifaceted",
    "tapestry",
    "holistic",
    "nuanced",
    "paradigm shift",
    "game-changing",
    "transformative",
    "innovative",
];

/// AI hedging phrases to avoid.
pub const AI_HEDGING_PHRASES: &[&str] = &[
    "it's important to note that",
    "it is worth mentioning",
    "in today's landscape",
    "in the ever-evolving",
];

// ============================================================================
// Prompt Templates
// ============================================================================

/// Quality preservation constraints appended to all non-off prompts.
const QUALITY_CONSTRAINTS: &str = "\n\nQUALITY CONSTRAINTS (non-negotiable):
- Maintain professional tone and confidence
- No spelling or grammar errors (variations are stylistic, not errors)
- Technical accuracy preserved
- Message clarity not compromised
- Still sounds competent and experienced";

/// Build the humanization prompt block for the given intensity.
/// Returns `None` if intensity is Off (no humanization instructions needed).
pub fn get_humanization_prompt(intensity: &HumanizationIntensity) -> Option<String> {
    match intensity {
        HumanizationIntensity::Off => None,

        HumanizationIntensity::Light => Some(format!(
            r#"
Write naturally. Occasionally use contractions and vary sentence structure slightly.
Aim for about 0.5-1 subtle human touches per 100 words.
AVOID AI tells: Don't use "delve", "leverage", "utilize", "robust", "multifaceted" unless truly contextually appropriate.{}"#,
            QUALITY_CONSTRAINTS
        )),

        HumanizationIntensity::Medium => Some(format!(
            r#"
Write this proposal naturally, as a human freelancer would. Include 1-2 subtle human touches per 100 words:
- Occasional contractions (I'm, you're, we've) where natural
- Informal transitions sometimes (So, Now, Plus, That said)
- Vary sentence length (mix short punchy sentences with longer explanatory ones)
- Minor stylistic variations (sentence fragment for emphasis is OK)
- Minor repetition of a key phrase for emphasis, where natural
- Conversational tone while maintaining professionalism

AVOID AI tells: Don't use "delve", "leverage", "utilize", "robust", "multifaceted" unless truly contextually appropriate.

The output should sound like a confident, competent professional writing naturally—not overly formal, not overly casual.{}"#,
            QUALITY_CONSTRAINTS
        )),

        HumanizationIntensity::Heavy => Some(format!(
            r#"
Write conversationally, as a confident freelancer dashing off a well-considered reply. Include 2-3 natural human elements per 100 words:
- Frequent contractions (I'm, you're, we've, I'd, that's)
- Informal transitions (So, Now, Plus, That said, Anyway, Honestly)
- Mix very short sentences with longer ones for rhythm
- Occasional sentence fragments for emphasis
- Conversational questions followed by answers ("Why does this matter? Because...")
- Natural phrasing ("I've done this before" not "I have completed similar projects")
- Minor repetition of a key phrase for emphasis

AVOID AI tells: Don't use "delve", "leverage", "utilize", "robust", "multifaceted", "tapestry", "holistic", "nuanced".

Sound like a real person who happens to be great at their job—casual confidence, not corporate polish.{}"#,
            QUALITY_CONSTRAINTS
        )),
    }
}

/// Build a complete system prompt by appending humanization instructions
/// to the base prompt. If intensity is Off, returns the base prompt unchanged.
pub fn build_system_prompt(base_prompt: &str, intensity: &str) -> String {
    let parsed = match HumanizationIntensity::from_str_value(intensity) {
        Ok(i) => i,
        Err(_) => {
            tracing::warn!(
                intensity = %intensity,
                "Invalid humanization intensity, defaulting to Medium"
            );
            HumanizationIntensity::Medium
        }
    };

    match get_humanization_prompt(&parsed) {
        Some(humanization_block) => format!("{}\n{}", base_prompt, humanization_block),
        None => base_prompt.to_string(),
    }
}

// ============================================================================
// Humanization Analysis Utility (Task 4.1)
// ============================================================================

/// Metrics from analyzing a text for humanization elements.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HumanizationMetrics {
    /// Total word count of the analyzed text.
    pub word_count: usize,
    /// Number of contractions found (I'm, you're, etc.)
    pub contraction_count: usize,
    /// Number of informal transitions found (So, Now, Plus, etc.)
    pub informal_transition_count: usize,
    /// Number of short sentence fragments detected.
    pub sentence_fragment_count: usize,
    /// AI tell words found in the text.
    pub ai_tells_found: Vec<String>,
    /// Humanization rate per 100 words.
    pub rate_per_100_words: f32,
}

/// Common contractions that indicate human-like writing.
const CONTRACTIONS: &[&str] = &[
    "i'm", "you're", "we've", "they've", "he's", "she's", "it's", "we're",
    "they're", "i've", "you've", "i'd", "you'd", "we'd", "they'd", "i'll",
    "you'll", "we'll", "they'll", "can't", "won't", "don't", "doesn't",
    "didn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't",
    "hadn't", "couldn't", "wouldn't", "shouldn't", "let's", "that's",
    "what's", "who's", "here's", "there's",
];

/// Informal transition words/phrases that appear at sentence starts.
const INFORMAL_TRANSITIONS: &[&str] = &[
    "so", "now", "plus", "anyway", "actually", "honestly", "basically",
    "look", "listen", "sure",
];

/// Multi-word transitions checked at sentence level.
const MULTI_WORD_TRANSITIONS: &[&str] = &[
    "that said",
    "on top of that",
    "the thing is",
    "here's the thing",
    "long story short",
];

/// Analyze text for humanization metrics.
///
/// Counts contractions, informal transitions, sentence fragments, and AI tells.
/// Returns metrics including rate per 100 words.
pub fn analyze_humanization(text: &str) -> HumanizationMetrics {
    let words: Vec<&str> = text.split_whitespace().collect();
    let word_count = words.len();

    // Count contractions
    let contraction_count = words
        .iter()
        .filter(|w| {
            let lower = w.to_lowercase();
            let trimmed = lower.trim_matches(|c: char| !c.is_alphanumeric() && c != '\'');
            CONTRACTIONS.contains(&trimmed)
        })
        .count();

    // Split into sentences for transition and fragment analysis
    let sentences: Vec<&str> = text
        .split(|c: char| c == '.' || c == '!' || c == '?')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    // Count informal transitions at sentence starts
    let mut informal_transition_count = 0;
    for sentence in &sentences {
        let lower = sentence.to_lowercase();

        // Check single-word transitions
        let first_word = lower.split_whitespace().next().unwrap_or("");
        let first_word_clean = first_word.trim_matches(|c: char| !c.is_alphabetic());
        if INFORMAL_TRANSITIONS.contains(&first_word_clean) {
            informal_transition_count += 1;
            continue;
        }

        // Check multi-word transitions
        for transition in MULTI_WORD_TRANSITIONS {
            if lower.starts_with(transition) {
                informal_transition_count += 1;
                break;
            }
        }
    }

    // Count sentence fragments (short sentences ≤5 words, likely stylistic)
    let sentence_fragment_count = sentences
        .iter()
        .filter(|s| {
            let wc = s.split_whitespace().count();
            wc >= 1 && wc <= 5
        })
        .count();

    // Detect AI tells
    let lower_text = text.to_lowercase();
    let mut ai_tells_found: Vec<String> = Vec::new();

    for tell in AI_TELLS {
        if lower_text.contains(tell) {
            ai_tells_found.push(tell.to_string());
        }
    }

    for phrase in AI_HEDGING_PHRASES {
        if lower_text.contains(phrase) {
            ai_tells_found.push(phrase.to_string());
        }
    }

    // Calculate humanization rate per 100 words
    let humanization_elements = contraction_count + informal_transition_count + sentence_fragment_count;
    let rate_per_100_words = if word_count > 0 {
        (humanization_elements as f32 / word_count as f32) * 100.0
    } else {
        0.0
    };

    HumanizationMetrics {
        word_count,
        contraction_count,
        informal_transition_count,
        sentence_fragment_count,
        ai_tells_found,
        rate_per_100_words,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -- Intensity parsing tests --

    #[test]
    fn test_intensity_from_str_all_values() {
        assert_eq!(HumanizationIntensity::from_str_value("off").unwrap(), HumanizationIntensity::Off);
        assert_eq!(HumanizationIntensity::from_str_value("light").unwrap(), HumanizationIntensity::Light);
        assert_eq!(HumanizationIntensity::from_str_value("medium").unwrap(), HumanizationIntensity::Medium);
        assert_eq!(HumanizationIntensity::from_str_value("heavy").unwrap(), HumanizationIntensity::Heavy);
    }

    #[test]
    fn test_intensity_from_str_case_insensitive() {
        assert_eq!(HumanizationIntensity::from_str_value("MEDIUM").unwrap(), HumanizationIntensity::Medium);
        assert_eq!(HumanizationIntensity::from_str_value("Light").unwrap(), HumanizationIntensity::Light);
        assert_eq!(HumanizationIntensity::from_str_value(" heavy ").unwrap(), HumanizationIntensity::Heavy);
    }

    #[test]
    fn test_intensity_from_str_invalid() {
        assert!(HumanizationIntensity::from_str_value("max").is_err());
        assert!(HumanizationIntensity::from_str_value("").is_err());
        assert!(HumanizationIntensity::from_str_value("extreme").is_err());
    }

    #[test]
    fn test_intensity_as_str_roundtrip() {
        for intensity in &[
            HumanizationIntensity::Off,
            HumanizationIntensity::Light,
            HumanizationIntensity::Medium,
            HumanizationIntensity::Heavy,
        ] {
            let s = intensity.as_str();
            let parsed = HumanizationIntensity::from_str_value(s).unwrap();
            assert_eq!(&parsed, intensity);
        }
    }

    #[test]
    fn test_intensity_is_valid() {
        assert!(HumanizationIntensity::is_valid("off"));
        assert!(HumanizationIntensity::is_valid("light"));
        assert!(HumanizationIntensity::is_valid("medium"));
        assert!(HumanizationIntensity::is_valid("heavy"));
        assert!(!HumanizationIntensity::is_valid("extreme"));
        assert!(!HumanizationIntensity::is_valid(""));
    }

    // -- Intensity escalation tests (Story 3.4) --

    #[test]
    fn test_escalate_off_to_light() {
        let result = HumanizationIntensity::Off.escalate();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), HumanizationIntensity::Light);
    }

    #[test]
    fn test_escalate_light_to_medium() {
        let result = HumanizationIntensity::Light.escalate();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), HumanizationIntensity::Medium);
    }

    #[test]
    fn test_escalate_medium_to_heavy() {
        let result = HumanizationIntensity::Medium.escalate();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), HumanizationIntensity::Heavy);
    }

    #[test]
    fn test_escalate_heavy_returns_error() {
        let result = HumanizationIntensity::Heavy.escalate();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("maximum intensity"));
    }

    #[test]
    fn test_escalate_full_path() {
        // Test complete escalation path: Off → Light → Medium → Heavy → Error
        let mut intensity = HumanizationIntensity::Off;

        intensity = intensity.escalate().unwrap();
        assert_eq!(intensity, HumanizationIntensity::Light);

        intensity = intensity.escalate().unwrap();
        assert_eq!(intensity, HumanizationIntensity::Medium);

        intensity = intensity.escalate().unwrap();
        assert_eq!(intensity, HumanizationIntensity::Heavy);

        let final_result = intensity.escalate();
        assert!(final_result.is_err());
    }

    // -- Prompt construction tests --

    #[test]
    fn test_off_returns_none() {
        assert!(get_humanization_prompt(&HumanizationIntensity::Off).is_none());
    }

    #[test]
    fn test_light_prompt_contains_required_elements() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Light).unwrap();
        assert!(prompt.contains("contraction"));
        assert!(prompt.contains("0.5-1"));
        assert!(prompt.contains("AVOID AI tells"));
        assert!(prompt.contains("delve"));
        assert!(prompt.contains("QUALITY CONSTRAINTS"));
    }

    #[test]
    fn test_medium_prompt_contains_required_elements() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Medium).unwrap();
        assert!(prompt.contains("1-2 subtle human touches"));
        assert!(prompt.contains("contraction"));
        assert!(prompt.contains("Informal transitions"));
        assert!(prompt.contains("Vary sentence length"));
        assert!(prompt.contains("AVOID AI tells"));
        assert!(prompt.contains("delve"));
        assert!(prompt.contains("leverage"));
        assert!(prompt.contains("QUALITY CONSTRAINTS"));
        assert!(prompt.contains("professional"));
        assert!(prompt.contains("repetition")); // AC4: Minor repetition
    }

    #[test]
    fn test_heavy_prompt_contains_required_elements() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Heavy).unwrap();
        assert!(prompt.contains("2-3"));
        assert!(prompt.contains("contraction"));
        assert!(prompt.contains("Informal transitions"));
        assert!(prompt.contains("sentence fragment"));
        assert!(prompt.contains("Conversational questions"));
        assert!(prompt.contains("AVOID AI tells"));
        assert!(prompt.contains("QUALITY CONSTRAINTS"));
        assert!(prompt.contains("repetition")); // AC4: Minor repetition
    }

    #[test]
    fn test_build_system_prompt_off_returns_base() {
        let base = "You are a proposal writer.";
        let result = build_system_prompt(base, "off");
        assert_eq!(result, base);
    }

    #[test]
    fn test_build_system_prompt_medium_appends_humanization() {
        let base = "You are a proposal writer.";
        let result = build_system_prompt(base, "medium");
        assert!(result.starts_with(base));
        assert!(result.len() > base.len());
        assert!(result.contains("1-2 subtle human touches"));
    }

    #[test]
    fn test_build_system_prompt_invalid_defaults_to_medium() {
        let base = "You are a proposal writer.";
        let result = build_system_prompt(base, "invalid_value");
        assert!(result.contains("1-2 subtle human touches"));
    }

    // -- Humanization analysis tests --

    #[test]
    fn test_analyze_empty_text() {
        let metrics = analyze_humanization("");
        assert_eq!(metrics.word_count, 0);
        assert_eq!(metrics.contraction_count, 0);
        assert_eq!(metrics.rate_per_100_words, 0.0);
    }

    #[test]
    fn test_analyze_detects_contractions() {
        let text = "I'm excited to help with your project. You're looking for someone who can't just code but also understands UX. We've done this before.";
        let metrics = analyze_humanization(text);
        assert!(metrics.contraction_count >= 3); // I'm, You're, can't, We've
    }

    #[test]
    fn test_analyze_detects_informal_transitions() {
        let text = "So here's my approach to your project. Now I know what you might be thinking. Plus I've worked on similar systems.";
        let metrics = analyze_humanization(text);
        assert!(metrics.informal_transition_count >= 2); // So, Now, Plus
    }

    #[test]
    fn test_analyze_detects_sentence_fragments() {
        let text = "Experience? 8 years in fintech. Fast delivery. That's what you need. I can start immediately and deliver within your timeline requirements.";
        let metrics = analyze_humanization(text);
        assert!(metrics.sentence_fragment_count >= 2);
    }

    #[test]
    fn test_analyze_detects_ai_tells() {
        let text = "I will leverage my robust experience to delve into your project requirements and utilize cutting-edge technology.";
        let metrics = analyze_humanization(text);
        assert!(metrics.ai_tells_found.contains(&"leverage".to_string()));
        assert!(metrics.ai_tells_found.contains(&"robust".to_string()));
        assert!(metrics.ai_tells_found.contains(&"delve".to_string()));
        assert!(metrics.ai_tells_found.contains(&"utilize".to_string()));
    }

    #[test]
    fn test_analyze_no_ai_tells_in_clean_text() {
        let text = "I'm excited about this project. I've built similar apps before and can start right away. So let's discuss the details.";
        let metrics = analyze_humanization(text);
        assert!(metrics.ai_tells_found.is_empty());
    }

    #[test]
    fn test_analyze_rate_calculation() {
        // ~25 words with ~2 humanization elements → ~8 per 100 words
        let text = "I'm excited about your project. So here's what I think we should do. I've built similar systems before and can help.";
        let metrics = analyze_humanization(text);
        assert!(metrics.word_count > 0);
        assert!(metrics.rate_per_100_words > 0.0);
    }

    #[test]
    fn test_analyze_ai_hedging_phrases() {
        let text = "It's important to note that this approach requires careful planning. In today's landscape, businesses need robust solutions.";
        let metrics = analyze_humanization(text);
        assert!(metrics.ai_tells_found.contains(&"it's important to note that".to_string()));
        assert!(metrics.ai_tells_found.contains(&"robust".to_string()));
    }

    #[test]
    fn test_rate_description() {
        assert_eq!(HumanizationIntensity::Off.rate_description(), "No humanization");
        assert!(HumanizationIntensity::Light.rate_description().contains("0.5-1"));
        assert!(HumanizationIntensity::Medium.rate_description().contains("1-2"));
        assert!(HumanizationIntensity::Heavy.rate_description().contains("2-3"));
    }
}
