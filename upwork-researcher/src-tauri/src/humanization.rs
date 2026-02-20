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
            Self::Heavy => {
                Err("Already at maximum intensity (Heavy). Consider manual editing.".to_string())
            }
        }
    }
}

// ============================================================================
// AI Tells — words/phrases that signal AI-generated text
// ============================================================================

/// Words that research identifies as strong AI-writing signals.
/// These are flagged by detection tools (GPTZero, ZeroGPT, Copyleaks, etc.)
/// Expanded from 12 → 35 based on TD-1 Task 2 research (2026 detection landscape).
pub const AI_TELLS: &[&str] = &[
    "delve",
    "leverage",
    "utilize",
    "robust",
    "multifaceted",
    "tapestry",
    "holistic",
    "nuanced",
    "paradigm",
    "game-changing",
    "transformative",
    "innovative",
    "cutting-edge",
    "state-of-the-art",
    "comprehensive",
    "seamless",
    "streamline",
    "optimize",
    "spearheaded",
    "synergy",
    "ecosystem",
    "landscape",
    "realm",
    "endeavor",
    "keen",
    "pivotal",
    "elevate",
    "foster",
    "harness",
    "facilitate",
    "empower",
    "cornerstone",
    "testament",
    "underscore",
    "meticulous",
];

/// AI hedging phrases and formulaic openings to avoid.
/// Expanded from 4 → 15 based on TD-1 Task 2 detection research.
pub const AI_HEDGING_PHRASES: &[&str] = &[
    "it's important to note that",
    "it is worth mentioning",
    "in today's landscape",
    "in the ever-evolving",
    "i am excited to",
    "i am confident that",
    "i would be happy to",
    "i look forward to",
    "rest assured",
    "don't hesitate to",
    "feel free to",
    "my extensive experience",
    "proven track record",
    "i am well-versed in",
    "i bring a wealth of",
];

// ============================================================================
// Prompt Templates
// ============================================================================

/// Lightweight guardrails appended to all non-off prompts.
/// TD-1: Relaxed from the original "quality constraints" which fought humanization.
const QUALITY_GUARDRAILS: &str = "\n\nQUALITY GUARDRAILS:
- Stay professional — casual doesn't mean sloppy
- Technical claims must be accurate
- The message should be clear and actionable
- Typos are NOT humanization — maintain correct spelling";

/// Build the humanization prompt block for the given intensity.
/// Returns `None` if intensity is Off (no humanization instructions needed).
///
/// TD-1 rewrite: Prompts now use specific, countable requirements targeting
/// the statistical signals (burstiness, perplexity variation, structural
/// unpredictability) that AI detection tools measure.
pub fn get_humanization_prompt(intensity: &HumanizationIntensity) -> Option<String> {
    match intensity {
        HumanizationIntensity::Off => None,

        HumanizationIntensity::Light => Some(format!(
            r#"
Write naturally with a conversational touch. About 0.5-1 subtle human elements per 100 words.

GUIDELINES:
- Use contractions where natural (I'm, you're, I've, that's, won't, can't)
- Vary sentence length — mix short and long
- Avoid overly formal or stilted language

AVOID these AI-signaling words: "delve", "leverage", "utilize", "robust", "multifaceted", "innovative", "comprehensive", "seamless", "streamline", "cutting-edge", "holistic", "transformative", "facilitate", "optimize", "spearheaded"

AVOID these phrases: "I am excited to", "I look forward to", "It's important to note", "proven track record", "I am confident that", "don't hesitate to"{}"#,
            QUALITY_GUARDRAILS
        )),

        HumanizationIntensity::Medium => Some(format!(
            r#"
CRITICAL: Write this as a real human freelancer would actually type it. This is a quick, confident message — NOT a formal cover letter.

MANDATORY STRUCTURE (follow these exactly):
- Do NOT write exactly 3 equal paragraphs. Use 2-4 paragraphs of varying length.
- At least one paragraph must be only 1-2 sentences. Another must be 3+ sentences.
- Include at least ONE sentence under 6 words (e.g. "Here's my take." or "Happy to chat.")
- Include at least ONE sentence over 20 words.
- Start at least one sentence with "And", "But", or "So".
- Use at least one parenthetical aside (like this) or em-dash — for a natural break.

MANDATORY WORD CHOICE:
- Use contractions everywhere: I'm, I've, you're, that's, won't, can't, I'd, we'll — minimum 6 per 200 words.
- Reference ONE specific detail from past experience (a project type, a metric, a tool).
- Include at least one casual expression: "happy to chat", "sounds like", "right up my alley", "pretty straightforward", "the short version", "quick note".
- Replace formal verbs with casual ones: "utilize" → "use", "implement" → "build", "facilitate" → "help", "demonstrate" → "show".

ABSOLUTELY FORBIDDEN (these instantly flag AI detection):
Words: "delve", "leverage", "utilize", "robust", "multifaceted", "tapestry", "holistic", "nuanced", "paradigm", "game-changing", "transformative", "innovative", "cutting-edge", "state-of-the-art", "comprehensive", "seamless", "streamline", "optimize", "spearheaded", "synergy", "ecosystem", "landscape", "realm", "endeavor", "keen", "pivotal", "elevate", "foster", "harness", "empower", "facilitate", "cornerstone", "testament", "underscore", "meticulous"
Phrases: "I am excited to", "I am confident that", "I would be happy to", "It's important to note", "It is worth mentioning", "In today's", "In the ever-evolving", "I look forward to", "rest assured", "don't hesitate to", "feel free to", "my extensive experience", "proven track record", "I am well-versed in", "I bring a wealth of"
Patterns: Starting 3+ sentences the same way. Every paragraph being similar length. Using the same transition word twice.

TONE: Imagine you're messaging a potential client about a project that genuinely interests you — confident but not salesy, direct but not blunt.{}"#,
            QUALITY_GUARDRAILS
        )),

        HumanizationIntensity::Heavy => Some(format!(
            r#"
CRITICAL: Write exactly as a busy, confident freelancer would — typing quickly, genuine interest. Think Slack message to a potential client, not cover letter.

MANDATORY STRUCTURE (follow these exactly):
- Use 2-4 paragraphs of DRAMATICALLY different lengths. One short (1-2 sentences), one longer (3-4 sentences).
- Include at least TWO sentences under 6 words. ("That's my jam." "Happy to jump in." "Quick background.")
- Include ONE sentence over 25 words with a natural mid-sentence break (dash or parenthetical).
- Start at least TWO sentences with "And", "But", "So", or "Plus".
- Include one aside in parentheses or after a dash.
- Break one expected pattern: use a rhetorical question, a self-correction ("well, actually..."), or an incomplete thought.

MANDATORY WORD CHOICE:
- Contractions everywhere — minimum 8 per 200 words. Never write "I am" when "I'm" works.
- Reference TWO specific details (project type + a metric, tool, or outcome from experience).
- Include at least TWO casual expressions.
- Include ONE thinking-aloud moment: "I'm thinking...", "The way I see it...", "Off the top of my head...".
- One or two natural fillers: "pretty much", "honestly", "basically".

ABSOLUTELY FORBIDDEN (these instantly flag AI detection):
Words: "delve", "leverage", "utilize", "robust", "multifaceted", "tapestry", "holistic", "nuanced", "paradigm", "game-changing", "transformative", "innovative", "cutting-edge", "state-of-the-art", "comprehensive", "seamless", "streamline", "optimize", "spearheaded", "synergy", "ecosystem", "landscape", "realm", "endeavor", "keen", "pivotal", "elevate", "foster", "harness", "empower", "facilitate", "cornerstone", "testament", "underscore", "meticulous"
Phrases: "I am excited to", "I am confident that", "I would be happy to", "It's important to note", "It is worth mentioning", "In today's", "In the ever-evolving", "I look forward to", "rest assured", "don't hesitate to", "feel free to", "my extensive experience", "proven track record", "I am well-versed in", "I bring a wealth of"
Patterns: Starting 3+ sentences the same way. Every paragraph being similar length. Using the same transition word twice. Numbered lists in proposals.

TONE: You just saw a job post that's exactly what you do, and you're genuinely stoked. Write like it.{}"#,
            QUALITY_GUARDRAILS
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
// Re-humanization Boost (TD-1 Task 4)
// ============================================================================

/// Additional prompt appended during re-humanization attempts (Story 3.4 + TD-1).
/// Targets specific AI detection signals more aggressively than the base prompts.
/// This is appended AFTER the escalated intensity prompt for maximum effect.
pub fn get_rehumanization_boost(attempt: u32) -> Option<String> {
    match attempt {
        1 => Some(
            r#"

IMPORTANT — PREVIOUS VERSION WAS FLAGGED AS AI-GENERATED. Apply these additional fixes:
- Rewrite the opening sentence to be more specific and personal (reference a real-sounding detail)
- Break up any paragraph longer than 3 sentences into two shorter ones
- Add one conversational aside you wouldn't see in formal writing
- Make sure no two consecutive sentences start the same way
- Include at least one short reaction or opinion ("Neat.", "That's smart.", "Big fan of that approach.")"#
                .to_string(),
        ),
        2 => Some(
            r#"

CRITICAL — SECOND ATTEMPT. The previous two versions were flagged as AI. Be MORE aggressive:
- Write as if you're typing this on your phone during lunch — keep it casual and direct
- Start with something unexpected (a question, a brief reaction, or a specific observation)
- Cut any sentence that sounds like a template or could appear in any proposal
- Use at least 2 sentence fragments (under 5 words) as standalone emphasis
- Vary paragraph lengths dramatically — one paragraph should be a single sentence
- Include ONE personal detail that sounds specific ("I just wrapped up a similar project for a SaaS startup last month")
- Do NOT use formal proposal language — this should read like a genuine message from a real person"#
                .to_string(),
        ),
        3 => Some(
            r#"

FINAL ATTEMPT — Every previous version was flagged. Throw out everything and start fresh:
- Pretend you're voice-texting a reply while walking — raw, unpolished, genuine
- Open with a specific observation or question about the job post (NOT a greeting)
- Maximum 3 paragraphs. One must be a single sentence.
- Use at least 3 sentence fragments. No sentence over 18 words.
- Include a self-correction or mid-thought change ("actually, scratch that — ...")
- Reference a hyper-specific past detail (client name style, dollar amount, timeline)
- Zero transition words between paragraphs — just jump between ideas
- If it sounds like it could be in a template, delete it"#
                .to_string(),
        ),
        _ => None,
    }
}

/// Build a system prompt with both humanization intensity AND re-humanization boost.
/// Used by the regeneration flow when a proposal failed AI detection.
pub fn build_rehumanization_prompt(base_prompt: &str, intensity: &str, attempt: u32) -> String {
    let mut prompt = build_system_prompt(base_prompt, intensity);
    if let Some(boost) = get_rehumanization_boost(attempt) {
        prompt.push_str(&boost);
    }
    prompt
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
    "i'm",
    "you're",
    "we've",
    "they've",
    "he's",
    "she's",
    "it's",
    "we're",
    "they're",
    "i've",
    "you've",
    "i'd",
    "you'd",
    "we'd",
    "they'd",
    "i'll",
    "you'll",
    "we'll",
    "they'll",
    "can't",
    "won't",
    "don't",
    "doesn't",
    "didn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "hasn't",
    "haven't",
    "hadn't",
    "couldn't",
    "wouldn't",
    "shouldn't",
    "let's",
    "that's",
    "what's",
    "who's",
    "here's",
    "there's",
];

/// Informal transition words/phrases that appear at sentence starts.
const INFORMAL_TRANSITIONS: &[&str] = &[
    "so",
    "now",
    "plus",
    "anyway",
    "actually",
    "honestly",
    "basically",
    "look",
    "listen",
    "sure",
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
        .split(['.', '!', '?'])
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
            (1..=5).contains(&wc)
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
    let humanization_elements =
        contraction_count + informal_transition_count + sentence_fragment_count;
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
        assert_eq!(
            HumanizationIntensity::from_str_value("off").unwrap(),
            HumanizationIntensity::Off
        );
        assert_eq!(
            HumanizationIntensity::from_str_value("light").unwrap(),
            HumanizationIntensity::Light
        );
        assert_eq!(
            HumanizationIntensity::from_str_value("medium").unwrap(),
            HumanizationIntensity::Medium
        );
        assert_eq!(
            HumanizationIntensity::from_str_value("heavy").unwrap(),
            HumanizationIntensity::Heavy
        );
    }

    #[test]
    fn test_intensity_from_str_case_insensitive() {
        assert_eq!(
            HumanizationIntensity::from_str_value("MEDIUM").unwrap(),
            HumanizationIntensity::Medium
        );
        assert_eq!(
            HumanizationIntensity::from_str_value("Light").unwrap(),
            HumanizationIntensity::Light
        );
        assert_eq!(
            HumanizationIntensity::from_str_value(" heavy ").unwrap(),
            HumanizationIntensity::Heavy
        );
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
        assert!(prompt.contains("AVOID"));
        assert!(prompt.contains("delve"));
        assert!(prompt.contains("QUALITY GUARDRAILS"));
    }

    #[test]
    fn test_medium_prompt_contains_required_elements() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Medium).unwrap();
        assert!(prompt.contains("MANDATORY STRUCTURE"));
        assert!(prompt.contains("contraction"));
        assert!(prompt.contains("MANDATORY WORD CHOICE"));
        assert!(prompt.contains("under 6 words"));
        assert!(prompt.contains("ABSOLUTELY FORBIDDEN"));
        assert!(prompt.contains("delve"));
        assert!(prompt.contains("leverage"));
        assert!(prompt.contains("QUALITY GUARDRAILS"));
        assert!(prompt.contains("casual expression"));
    }

    #[test]
    fn test_heavy_prompt_contains_required_elements() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Heavy).unwrap();
        assert!(prompt.contains("MANDATORY STRUCTURE"));
        assert!(prompt.contains("DRAMATICALLY different"));
        assert!(prompt.contains("Contractions"));
        assert!(prompt.contains("thinking-aloud"));
        assert!(prompt.contains("rhetorical question"));
        assert!(prompt.contains("ABSOLUTELY FORBIDDEN"));
        assert!(prompt.contains("QUALITY GUARDRAILS"));
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
        assert!(result.contains("MANDATORY STRUCTURE"));
    }

    #[test]
    fn test_build_system_prompt_invalid_defaults_to_medium() {
        let base = "You are a proposal writer.";
        let result = build_system_prompt(base, "invalid_value");
        assert!(result.contains("MANDATORY STRUCTURE"));
    }

    // -- Re-humanization boost tests (TD-1 Task 4) --

    #[test]
    fn test_rehumanization_boost_attempt_1() {
        let boost = get_rehumanization_boost(1);
        assert!(boost.is_some());
        let text = boost.unwrap();
        assert!(text.contains("FLAGGED AS AI-GENERATED"));
        assert!(text.contains("personal"));
    }

    #[test]
    fn test_rehumanization_boost_attempt_2() {
        let boost = get_rehumanization_boost(2);
        assert!(boost.is_some());
        let text = boost.unwrap();
        assert!(text.contains("SECOND ATTEMPT"));
        assert!(text.contains("sentence fragments"));
    }

    #[test]
    fn test_rehumanization_boost_attempt_0_returns_none() {
        assert!(get_rehumanization_boost(0).is_none());
    }

    #[test]
    fn test_rehumanization_boost_attempt_3() {
        let boost = get_rehumanization_boost(3);
        assert!(boost.is_some());
        let text = boost.unwrap();
        assert!(text.contains("FINAL ATTEMPT"));
        assert!(text.contains("voice-texting"));
    }

    #[test]
    fn test_rehumanization_boost_attempt_4_returns_none() {
        assert!(get_rehumanization_boost(4).is_none());
    }

    #[test]
    fn test_build_rehumanization_prompt_includes_boost() {
        let base = "You are a proposal writer.";
        let result = build_rehumanization_prompt(base, "heavy", 1);
        assert!(result.contains("MANDATORY STRUCTURE")); // Heavy prompt
        assert!(result.contains("FLAGGED AS AI-GENERATED")); // Boost
    }

    #[test]
    fn test_build_rehumanization_prompt_no_boost_at_attempt_0() {
        let base = "You are a proposal writer.";
        let result = build_rehumanization_prompt(base, "medium", 0);
        assert!(result.contains("MANDATORY STRUCTURE")); // Medium prompt
        assert!(!result.contains("FLAGGED AS AI-GENERATED")); // No boost
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
        assert!(metrics
            .ai_tells_found
            .contains(&"it's important to note that".to_string()));
        assert!(metrics.ai_tells_found.contains(&"robust".to_string()));
    }

    #[test]
    fn test_analyze_expanded_ai_tells() {
        let text = "I will facilitate a comprehensive review to harness cutting-edge technology and foster innovation in this ecosystem.";
        let metrics = analyze_humanization(text);
        assert!(metrics.ai_tells_found.contains(&"facilitate".to_string()));
        assert!(metrics
            .ai_tells_found
            .contains(&"comprehensive".to_string()));
        assert!(metrics.ai_tells_found.contains(&"harness".to_string()));
        assert!(metrics.ai_tells_found.contains(&"cutting-edge".to_string()));
        assert!(metrics.ai_tells_found.contains(&"foster".to_string()));
        assert!(metrics.ai_tells_found.contains(&"ecosystem".to_string()));
    }

    #[test]
    fn test_analyze_expanded_hedging_phrases() {
        let text = "I am excited to apply. I am confident that my extensive experience and proven track record make me well-suited.";
        let metrics = analyze_humanization(text);
        assert!(metrics
            .ai_tells_found
            .contains(&"i am excited to".to_string()));
        assert!(metrics
            .ai_tells_found
            .contains(&"i am confident that".to_string()));
        assert!(metrics
            .ai_tells_found
            .contains(&"proven track record".to_string()));
    }

    // -- Prompt/constant sync verification (Code Review H1 fix) --

    #[test]
    fn test_medium_prompt_contains_all_ai_tells() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Medium)
            .unwrap()
            .to_lowercase();
        for tell in AI_TELLS {
            assert!(
                prompt.contains(tell),
                "Medium prompt missing AI_TELLS word: '{}'",
                tell
            );
        }
    }

    #[test]
    fn test_heavy_prompt_contains_all_ai_tells() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Heavy)
            .unwrap()
            .to_lowercase();
        for tell in AI_TELLS {
            assert!(
                prompt.contains(tell),
                "Heavy prompt missing AI_TELLS word: '{}'",
                tell
            );
        }
    }

    #[test]
    fn test_medium_prompt_contains_all_hedging_phrases() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Medium)
            .unwrap()
            .to_lowercase();
        for phrase in AI_HEDGING_PHRASES {
            // Prompt may use shortened prefix (e.g. "In today's" for "in today's landscape")
            // Prompt may use shortened prefix (e.g. "In today's" for "in today's landscape")
            let check = if phrase.split_whitespace().count() > 2 {
                phrase
                    .split_whitespace()
                    .take(2)
                    .collect::<Vec<_>>()
                    .join(" ")
            } else {
                phrase.to_string()
            };
            assert!(
                prompt.contains(&check),
                "Medium prompt missing hedging phrase (or prefix): '{}'",
                phrase
            );
        }
    }

    #[test]
    fn test_heavy_prompt_contains_all_hedging_phrases() {
        let prompt = get_humanization_prompt(&HumanizationIntensity::Heavy)
            .unwrap()
            .to_lowercase();
        for phrase in AI_HEDGING_PHRASES {
            let check = if phrase.split_whitespace().count() > 2 {
                phrase
                    .split_whitespace()
                    .take(2)
                    .collect::<Vec<_>>()
                    .join(" ")
            } else {
                phrase.to_string()
            };
            assert!(
                prompt.contains(&check),
                "Heavy prompt missing hedging phrase (or prefix): '{}'",
                phrase
            );
        }
    }

    #[test]
    fn test_rate_description() {
        assert_eq!(
            HumanizationIntensity::Off.rate_description(),
            "No humanization"
        );
        assert!(HumanizationIntensity::Light
            .rate_description()
            .contains("0.5-1"));
        assert!(HumanizationIntensity::Medium
            .rate_description()
            .contains("1-2"));
        assert!(HumanizationIntensity::Heavy
            .rate_description()
            .contains("2-3"));
    }
}
