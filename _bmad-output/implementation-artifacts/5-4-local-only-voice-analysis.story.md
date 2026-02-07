---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 5
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 5.4: Local-Only Voice Analysis

## Story

As a freelancer,
I want my past proposals analyzed locally without sending full text to any server,
So that my competitive writing samples stay private.

## Acceptance Criteria

**AC-1:** Given I've uploaded 3+ Golden Set proposals (Story 5-3), When I click "Calibrate Voice", Then the system analyzes all proposals locally in Rust backend (NOT via API call)

**AC-2:** And the analysis extracts the following parameters:
- **Tone Score** (1-10 scale: 1=very casual, 10=very formal) — derived from vocabulary formality
- **Average Sentence Length** (integer: words per sentence)
- **Vocabulary Complexity** (Flesch-Kincaid grade level: 1-16)
- **Structure Preference** (JSON: `{"paragraphs": 60, "bullets": 40}` percentages)
- **Technical Depth** (1-10 scale: % of technical/domain terms)
- **Common Phrases** (JSON array of top 5 repeated 3+ word phrases)

**AC-3:** And calibration completes in <2 seconds for 5 proposals (NFR performance target)

**AC-4:** And the UI shows progress: "Analyzing proposals... (3/5)"

**AC-5:** And upon completion, I see: "✓ Proposals analyzed locally in 1.2s. No text was uploaded."

**AC-6:** And extracted parameters are returned to frontend (for Story 5-5 display) and ready for persistence (Story 5-5b)

## Tasks/Subtasks

- [ ] Task 1: Implement text analysis module in Rust (AC-2)
  - [ ] Subtask 1.1: Create voice/analyzer.rs module
  - [ ] Subtask 1.2: Implement sentence segmentation (split on . ! ? handling abbreviations)
  - [ ] Subtask 1.3: Implement average sentence length calculation
  - [ ] Subtask 1.4: Implement Flesch-Kincaid grade level calculation
  - [ ] Subtask 1.5: Implement formality/tone scoring (formal word ratio)
  - [ ] Subtask 1.6: Implement structure detection (bullet vs paragraph ratio)
  - [ ] Subtask 1.7: Implement technical depth detection (domain term ratio)
  - [ ] Subtask 1.8: Implement common phrase extraction (n-gram analysis)

- [ ] Task 2: Create VoiceProfile struct and analysis aggregation (AC-2, AC-6)
  - [ ] Subtask 2.1: Define VoiceProfile struct with all parameter fields
  - [ ] Subtask 2.2: Implement analyze_single_proposal() function
  - [ ] Subtask 2.3: Implement aggregate_voice_profile() to combine multiple proposals
  - [ ] Subtask 2.4: Add serde derives for JSON serialization

- [ ] Task 3: Add Tauri command for voice calibration (AC-1, AC-3, AC-4)
  - [ ] Subtask 3.1: Create calibrate_voice command in commands/voice.rs
  - [ ] Subtask 3.2: Load golden_set_proposals from database
  - [ ] Subtask 3.3: Run analysis on each proposal
  - [ ] Subtask 3.4: Emit progress events via Tauri events ("analysis_progress")
  - [ ] Subtask 3.5: Return aggregated VoiceProfile
  - [ ] Subtask 3.6: Track and return elapsed time

- [ ] Task 4: Build calibration UI component (AC-4, AC-5)
  - [ ] Subtask 4.1: Create VoiceCalibration.tsx in features/voice-learning/
  - [ ] Subtask 4.2: Add "Calibrate Voice" button
  - [ ] Subtask 4.3: Listen to Tauri progress events
  - [ ] Subtask 4.4: Show progress indicator: "Analyzing proposals... (3/5)"
  - [ ] Subtask 4.5: Show completion message with elapsed time
  - [ ] Subtask 4.6: Pass results to parent for display (Story 5-5)

- [ ] Task 5: Add tests (AC-1 through AC-6)
  - [ ] Subtask 5.1: Test sentence segmentation edge cases
  - [ ] Subtask 5.2: Test Flesch-Kincaid calculation accuracy
  - [ ] Subtask 5.3: Test tone scoring on known formal/casual text
  - [ ] Subtask 5.4: Test structure detection (bullets vs paragraphs)
  - [ ] Subtask 5.5: Test aggregation of multiple proposals
  - [ ] Subtask 5.6: Test performance (<2s for 5 proposals of 500 words each)
  - [ ] Subtask 5.7: Test UI progress updates

## Dev Notes

### Architecture Requirements

**AR-12: Privacy Layer**
- All analysis happens in Rust backend — NO API calls
- Only derived parameters (numbers, percentages, phrases) are output
- Raw proposal text NEVER leaves the local machine
- This is the core privacy guarantee of the voice learning feature

**FR-16: Golden Set Calibration**
- Extract style patterns and apply within 30 seconds
- Mitigate Cold Start problem with one-time setup

**NFR Performance: <2 seconds for 5 proposals**
- Pure computation in Rust (no I/O except initial DB read)
- Proposals already in memory from golden_set_proposals table

### VoiceProfile Struct

```rust
// voice/profile.rs

use serde::{Deserialize, Serialize};

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

    /// Top repeated phrases (3+ words, appearing 2+ times)
    pub common_phrases: Vec<String>,

    /// Number of proposals analyzed
    pub sample_count: u32,

    /// Calibration source
    pub calibration_source: CalibrationSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructurePreference {
    pub paragraphs_pct: u8,  // 0-100
    pub bullets_pct: u8,     // 0-100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalibrationSource {
    GoldenSet,
    QuickCalibration,
    Implicit,  // Future: from edit patterns
}
```

### Text Analysis Algorithms

**1. Sentence Segmentation**
```rust
// Split on sentence-ending punctuation, handling common abbreviations
fn segment_sentences(text: &str) -> Vec<&str> {
    // Handle: Mr. Mrs. Dr. vs. etc. i.e. e.g.
    // Use regex or rule-based approach
    // Return non-empty sentences only
}
```

**2. Average Sentence Length**
```rust
fn avg_sentence_length(sentences: &[&str]) -> f32 {
    let total_words: usize = sentences.iter()
        .map(|s| s.split_whitespace().count())
        .sum();
    total_words as f32 / sentences.len() as f32
}
```

**3. Flesch-Kincaid Grade Level**
```rust
// FK Grade = 0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
fn flesch_kincaid_grade(text: &str) -> f32 {
    let words = count_words(text);
    let sentences = count_sentences(text);
    let syllables = count_syllables(text);

    0.39 * (words as f32 / sentences as f32)
        + 11.8 * (syllables as f32 / words as f32)
        - 15.59
}

fn count_syllables(word: &str) -> usize {
    // Simplified: count vowel groups
    // More accurate: use CMU pronouncing dictionary or heuristics
}
```

**4. Tone/Formality Score**
```rust
// Ratio of formal vocabulary markers
fn calculate_tone_score(text: &str) -> f32 {
    let formal_markers = ["therefore", "consequently", "furthermore",
                          "regarding", "pursuant", "hereby"];
    let casual_markers = ["hey", "gonna", "wanna", "stuff", "things",
                          "awesome", "cool", "great"];

    let words: Vec<&str> = text.split_whitespace().collect();
    let formal_count = count_marker_occurrences(&words, &formal_markers);
    let casual_count = count_marker_occurrences(&words, &casual_markers);

    // Scale to 1-10 based on ratio
    // Also consider: sentence structure, contractions, etc.
}
```

**5. Structure Detection**
```rust
fn detect_structure(text: &str) -> StructurePreference {
    let lines: Vec<&str> = text.lines().collect();
    let bullet_patterns = ["-", "•", "*", "→", "1.", "2.", "3."];

    let bullet_lines = lines.iter()
        .filter(|l| bullet_patterns.iter().any(|p| l.trim().starts_with(p)))
        .count();

    let total_content_lines = lines.iter()
        .filter(|l| !l.trim().is_empty())
        .count();

    let bullets_pct = (bullet_lines as f32 / total_content_lines as f32 * 100.0) as u8;

    StructurePreference {
        paragraphs_pct: 100 - bullets_pct,
        bullets_pct,
    }
}
```

**6. Technical Depth**
```rust
fn calculate_technical_depth(text: &str) -> f32 {
    // Count technical indicators:
    // - Programming terms (API, database, framework names)
    // - Domain-specific jargon
    // - Acronyms (all caps 2+ letters)
    // - Numbers/metrics

    let words: Vec<&str> = text.split_whitespace().collect();
    let technical_count = count_technical_terms(&words);

    // Scale 1-10 based on percentage
    let ratio = technical_count as f32 / words.len() as f32;
    (ratio * 100.0).min(10.0).max(1.0)
}
```

**7. Common Phrases (N-gram extraction)**
```rust
fn extract_common_phrases(text: &str, min_words: usize, min_occurrences: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut phrase_counts: HashMap<String, usize> = HashMap::new();

    // Extract 3-grams, 4-grams, 5-grams
    for n in min_words..=5 {
        for window in words.windows(n) {
            let phrase = window.join(" ").to_lowercase();
            *phrase_counts.entry(phrase).or_insert(0) += 1;
        }
    }

    // Filter and sort by frequency
    let mut common: Vec<_> = phrase_counts.into_iter()
        .filter(|(_, count)| *count >= min_occurrences)
        .collect();
    common.sort_by(|a, b| b.1.cmp(&a.1));

    common.into_iter().take(5).map(|(phrase, _)| phrase).collect()
}
```

### Aggregation Across Proposals

```rust
fn aggregate_voice_profile(proposals: &[String]) -> VoiceProfile {
    let individual_profiles: Vec<_> = proposals.iter()
        .map(|p| analyze_single_proposal(p))
        .collect();

    // Average numeric scores
    let tone_score = individual_profiles.iter()
        .map(|p| p.tone_score)
        .sum::<f32>() / individual_profiles.len() as f32;

    // Similar for other fields...

    // Merge common phrases (union, re-rank by total frequency)
    let all_phrases: Vec<_> = individual_profiles.iter()
        .flat_map(|p| p.common_phrases.clone())
        .collect();
    let merged_phrases = dedupe_and_rank_phrases(all_phrases);

    VoiceProfile {
        tone_score,
        avg_sentence_length,
        vocabulary_complexity,
        structure_preference,
        technical_depth,
        common_phrases: merged_phrases,
        sample_count: proposals.len() as u32,
        calibration_source: CalibrationSource::GoldenSet,
    }
}
```

### Tauri Command

```rust
// commands/voice.rs

use tauri::{command, State, Window};
use std::time::Instant;

#[derive(Clone, Serialize)]
struct AnalysisProgress {
    current: usize,
    total: usize,
}

#[command]
pub async fn calibrate_voice(
    window: Window,
    state: State<'_, AppState>
) -> Result<CalibrationResult, AppError> {
    let start = Instant::now();

    // Load golden set proposals
    let proposals = state.db.get_golden_proposals()?;

    if proposals.len() < 3 {
        return Err(AppError::Validation("At least 3 proposals required".into()));
    }

    let total = proposals.len();
    let mut analyzed_texts = Vec::new();

    for (i, proposal) in proposals.iter().enumerate() {
        // Emit progress event
        window.emit("analysis_progress", AnalysisProgress {
            current: i + 1,
            total,
        })?;

        analyzed_texts.push(proposal.content.clone());
    }

    // Run analysis
    let profile = aggregate_voice_profile(&analyzed_texts);

    let elapsed = start.elapsed();

    Ok(CalibrationResult {
        profile,
        elapsed_ms: elapsed.as_millis() as u64,
        proposals_analyzed: total,
    })
}

#[derive(Serialize)]
pub struct CalibrationResult {
    pub profile: VoiceProfile,
    pub elapsed_ms: u64,
    pub proposals_analyzed: usize,
}
```

### UI Component

```tsx
// features/voice-learning/VoiceCalibration.tsx

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface AnalysisProgress {
  current: number;
  total: number;
}

interface CalibrationResult {
  profile: VoiceProfile;
  elapsed_ms: number;
  proposals_analyzed: number;
}

export function VoiceCalibration({ onComplete }: { onComplete: (profile: VoiceProfile) => void }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<AnalysisProgress>('analysis_progress', (event) => {
      setProgress(event.payload);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleCalibrate = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(null);

    try {
      const result = await invoke<CalibrationResult>('calibrate_voice');
      setResult(result);
      onComplete(result.profile);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="voice-calibration">
      {!result && !isAnalyzing && (
        <button onClick={handleCalibrate} className="primary">
          Calibrate Voice
        </button>
      )}

      {isAnalyzing && progress && (
        <div className="progress">
          <div className="spinner" />
          <span>Analyzing proposals... ({progress.current}/{progress.total})</span>
        </div>
      )}

      {result && (
        <div className="success">
          <span className="checkmark">✓</span>
          <span>
            Proposals analyzed locally in {(result.elapsed_ms / 1000).toFixed(1)}s.
            No text was uploaded.
          </span>
        </div>
      )}

      {error && (
        <div className="error">
          Analysis failed: {error}
        </div>
      )}
    </div>
  );
}
```

### File Structure

```
upwork-researcher/
  src-tauri/
    src/
      voice/
        mod.rs                    # Module exports
        analyzer.rs               # NEW: Text analysis algorithms
        profile.rs                # NEW: VoiceProfile struct
      commands/
        voice.rs                  # Add calibrate_voice command
  src/
    features/
      voice-learning/
        VoiceCalibration.tsx      # NEW: Calibration UI
        VoiceCalibration.test.tsx # NEW: Component tests
        types.ts                  # VoiceProfile TypeScript type
```

### Performance Optimization

**Target: <2 seconds for 5 proposals (~500 words each = ~2500 words total)**

- Pure in-memory computation (no I/O during analysis)
- Single pass where possible (count words, syllables, sentences together)
- Pre-compiled regex for sentence segmentation
- HashMap for phrase counting (O(1) lookups)
- Avoid string allocations in hot paths (use &str slices)

**Benchmarking:**
```rust
#[cfg(test)]
mod bench {
    #[test]
    fn test_performance_target() {
        let proposals: Vec<String> = (0..5)
            .map(|_| generate_sample_proposal(500)) // 500 words each
            .collect();

        let start = std::time::Instant::now();
        let _ = aggregate_voice_profile(&proposals);
        let elapsed = start.elapsed();

        assert!(elapsed.as_secs_f32() < 2.0,
            "Analysis took {:.2}s, exceeds 2s target", elapsed.as_secs_f32());
    }
}
```

### Testing Requirements

**Unit Tests (Rust):**

1. **Sentence Segmentation:**
   - Test: "Hello. How are you?" → 2 sentences
   - Test: "Dr. Smith went home." → 1 sentence (abbreviation handling)
   - Test: "What?! No way." → 2 sentences

2. **Flesch-Kincaid:**
   - Test known samples with expected grade levels
   - "The cat sat on the mat." → ~1-2 grade level
   - Technical paragraph → 10+ grade level

3. **Tone Scoring:**
   - Test casual text → score 1-3
   - Test formal business text → score 7-10
   - Test mixed text → score 4-6

4. **Structure Detection:**
   - Test all-paragraph text → 100% paragraphs
   - Test bulleted list → high bullet percentage
   - Test mixed → appropriate split

5. **Aggregation:**
   - Test averaging across 3 proposals
   - Test phrase merging logic

**Integration Tests:**

1. **Full Calibration Flow:**
   - Insert 3 test proposals to golden_set_proposals
   - Call calibrate_voice command
   - Verify VoiceProfile returned with all fields populated

2. **Performance Test:**
   - Insert 5 proposals of ~500 words each
   - Verify calibration completes in <2 seconds

**Frontend Tests:**

1. **Progress Updates:**
   - Mock Tauri events
   - Verify progress indicator updates
   - Verify completion message shown

### Scope Boundaries

**In Scope for Story 5.4:**
- Text analysis algorithms (all 7 metrics)
- VoiceProfile struct definition
- calibrate_voice Tauri command
- Progress event emission
- UI component with progress/completion states

**Out of Scope (Other Stories):**
- Persisting VoiceProfile to database (Story 5-5b)
- Displaying VoiceProfile details (Story 5-5)
- Using VoiceProfile in generation (Story 5-8)
- Quick Calibration alternative (Story 5-7)

### Dependencies

**Depends On:**
- Story 5-3: Golden Set Upload UI (provides proposals to analyze)

**Depended On By:**
- Story 5-5: Voice Profile Display (displays analysis results)
- Story 5-5b: Persist Voice Profile (saves to database)
- Story 5-8: Voice-Informed Proposal Generation (uses profile)

### Privacy Verification Checklist

- [ ] No network calls during analysis (verify with network monitor)
- [ ] Raw text never logged (check log statements)
- [ ] Only numeric/statistical outputs returned
- [ ] UI message confirms local processing
- [ ] Code review specifically checks for privacy compliance

### References

- [Source: epics-stories.md#Story 5.4: Local-Only Voice Analysis]
- [Source: architecture.md#AR-12: Prompt Privacy Layer]
- [Source: architecture.md#Voice Learning Data Architecture]
- [Source: prd.md#FR-16: Golden Set calibration within 30 seconds]
- [Flesch-Kincaid Formula Reference](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests)
