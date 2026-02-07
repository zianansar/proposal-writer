---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0/5
testsWritten: 0
dependencies:
  - 4a-2-client-name-extraction  # Extends the same analysis pipeline
  - 4b-2-skills-match-percentage-calculation  # Uses job_scores table
---

# Story 4b.3: Client Quality Score Estimation

## Story

As a freelancer,
I want to see an estimated client quality score,
So that I can avoid problematic clients.

## Acceptance Criteria

**AC-1:** Given a job post is being analyzed (Story 4a.2)
**When** Claude Haiku processes the job post text
**Then** it estimates client quality (0-100 integer scale) based on inference from:
- **Explicit signals:** "0 hires", "100% hire rate", "verified payment", "paid on time", "spent $X on Upwork"
- **Implicit signals:** Communication quality (specificity, professionalism, clarity vs vague, demanding, unrealistic)
- **Red flags:** "Urgent", "ASAP", "low budget", copy-pasted template, grammatical errors
**And** the score is stored in `job_scores.client_quality_score` (integer, 0-100)

**AC-2:** Given the client quality score is calculated
**When** I view the job analysis display
**Then** I see "Client Quality: 85" with color coding:
- Green (≥80): #10b981 — High-quality client likely
- Yellow (60-79): #f59e0b — Medium-quality client, proceed with caution
- Red (<60): #ef4444 — Low-quality client, high risk

**AC-3:** Given edge cases and hard rules
**When** the estimation runs
**Then** it applies:
- "0 hires" explicitly mentioned → force score to 45 (red, high risk)
- No clear signals in job post → default score 65 (yellow, neutral assumption)
- Contradictory signals → weighted average favoring red flags (conservative risk assessment)

## Tasks / Subtasks

### Backend Implementation (Rust + Prompt Engineering)

- [ ] Task 1: Extend job analysis to include client quality estimation (AC: #1)
  - [ ] Subtask 1.1: Decide integration approach:
    - Option A: Extend existing `analyze_job_post` in `analysis.rs` to include client_quality_score in response (RECOMMENDED — single API call, lower latency/cost)
    - Option B: Create separate `estimate_client_quality(job_post_text: String)` function (separate call, more flexible)
  - [ ] Subtask 1.2: If Option A, extend JobAnalysis struct: `pub struct JobAnalysis { client_name: Option<String>, key_skills: Vec<String>, client_quality_score: Option<i32> }`
  - [ ] Subtask 1.3: Design prompt to include client quality scoring instructions (see Dev Notes for prompt template)
  - [ ] Subtask 1.4: Update system prompt with few-shot examples for client quality inference
  - [ ] Subtask 1.5: Parse client_quality_score from JSON response: `{ "client_name": "...", "key_skills": [...], "client_quality_score": 85 }`
  - [ ] Subtask 1.6: Apply hard rule: if "0 hires" detected in job post, override score to 45
  - [ ] Subtask 1.7: Apply default: if LLM returns null or no score, default to 65

- [ ] Task 2: Store client quality score in database (AC: #1)
  - [ ] Subtask 2.1: After job analysis completes, INSERT or UPDATE job_scores table with client_quality_score
  - [ ] Subtask 2.2: Use ON CONFLICT(job_post_id) DO UPDATE pattern from Story 4b.2
  - [ ] Subtask 2.3: Handle case where job_scores row doesn't exist yet → INSERT
  - [ ] Subtask 2.4: Handle case where skills_match_percentage already exists → UPDATE only client_quality_score column

- [ ] Task 3: Create Tauri command to retrieve client quality score (AC: #2)
  - [ ] Subtask 3.1: Reuse `get_job_score(job_post_id)` command from Story 4b.2 (already returns JobScore with client_quality_score)
  - [ ] Subtask 3.2: If not implemented yet, create command that returns: `{ skills_match_percentage, client_quality_score, budget_alignment_score, overall_score }`
  - [ ] Subtask 3.3: Return null for client_quality_score if not calculated yet

### Frontend Implementation (React)

- [ ] Task 4: Display client quality score in job analysis UI (AC: #2)
  - [ ] Subtask 4.1: Identify display location (likely in JobAnalysisDisplay component alongside skills match from Story 4b.2)
  - [ ] Subtask 4.2: Call `get_job_score(job_post_id)` to retrieve client_quality_score
  - [ ] Subtask 4.3: Handle null score (analysis not run yet or LLM returned null) → display "Not available"
  - [ ] Subtask 4.4: Display score: "Client Quality: 85" (integer, no decimal)
  - [ ] Subtask 4.5: Apply color coding:
    - ≥80 → #10b981 (green)
    - 60-79 → #f59e0b (yellow)
    - <60 → #ef4444 (red)
  - [ ] Subtask 4.6: Add tooltip on hover: "Estimated quality based on job post signals. 80+ = high quality, 60-79 = medium, <60 = high risk"
  - [ ] Subtask 4.7: Add warning badge if score <60: "⚠️ High risk client"
  - [ ] Subtask 4.8: Style with dark mode (background #1a1a1a, text with appropriate color)

### Testing

- [ ] Task 5: Write backend and frontend tests
  - [ ] Subtask 5.1: Test client quality estimation with high-quality signals → returns score ≥80
  - [ ] Subtask 5.2: Test client quality estimation with medium signals → returns score 60-79
  - [ ] Subtask 5.3: Test client quality estimation with red flags → returns score <60
  - [ ] Subtask 5.4: Test "0 hires" hard rule → score forced to 45
  - [ ] Subtask 5.5: Test minimal job post with no signals → returns default score 65
  - [ ] Subtask 5.6: Test contradictory signals → returns weighted average favoring red flags
  - [ ] Subtask 5.7: Test score storage in job_scores table
  - [ ] Subtask 5.8: Test score retrieval via get_job_score command
  - [ ] Subtask 5.9: Test frontend displays green color for ≥80
  - [ ] Subtask 5.10: Test frontend displays yellow color for 60-79
  - [ ] Subtask 5.11: Test frontend displays red color with warning badge for <60
  - [ ] Subtask 5.12: Test frontend displays "Not available" when score is null

## Dev Notes

### Architecture Requirements

**AR-4: Claude Haiku for Analysis**
- Use Claude Haiku 4.5 for client quality estimation (cost-effective, fast)
- Latency target: <3s for analysis (NFR-6)
- Cost target: <$0.01 per analysis (inference is cheaper than generation)

**AR-5: Prompt Caching**
- System prompt with client quality scoring instructions should be cached
- Reduces cost by 90% for repeated analyses (prompt cache hit)
- Cache TTL: 5 minutes (Anthropic default)

**AR-2: SQLCipher Database Integration**
- client_quality_score stored in encrypted job_scores table (defined in Story 4b.2)
- Integer data type (0-100 scale)

### Non-Functional Requirements

**NFR-6: AI Streaming Start <1.5s**
- Client quality estimation is not streamed (single score response)
- But overall analysis latency must be <3s (includes client name + skills + quality)

**NFR-4: UI Response Time**
- Score display should update <100ms after analysis completes
- No blocking during analysis (show loading indicator)

**NFR-14: Accessibility (WCAG 2.1 AA)**
- Color coding must be supplemented with text (integer score always visible)
- Tooltip provides context for score interpretation
- Warning badge for high-risk clients uses both icon and text

### UX Requirements

**UX-1: Dark Mode by Default**
- Same colors as Story 4b.2: Green #10b981, Yellow #f59e0b, Red #ef4444
- High contrast on #1a1a1a background

**UX-5: Status Indicators**
- Client quality score displayed near skills match percentage (Story 4b.2)
- Warning badge (⚠️) for scores <60 draws immediate attention
- Tooltip provides educational context about what the score means

### Functional Requirements

**FR-4: Weighted Job Scoring**
- This story provides the **client quality component** of weighted scoring
- Story 4b.5 will combine: skills_match_percentage + client_quality_score + budget_alignment_score → overall_score
- Client quality is the **second most important factor** after skills match

### Story Position in Epic 4b Flow

**Story 4b.3 Position in Job Scoring Sequence:**
1. **Story 4b.1 (ENHANCED):** User configures skills → user_skills table
2. **Story 4b.2 (ENHANCED):** Skills match % → job_scores.skills_match_percentage
3. **→ Story 4b.3 (THIS STORY):** Client quality → job_scores.client_quality_score
4. **Story 4b.4 (NEXT):** Budget alignment → job_scores.budget_alignment_score
5. **Story 4b.5:** Weighted scoring → job_scores.overall_score (combines 4b.2, 4b.3, 4b.4)
6. **Story 4b.6:** Scoring breakdown UI → displays all scores

**Critical Dependencies:**
- **SHOULD extend Story 4a.2** (client name extraction analysis pipeline) — single API call more efficient
- **MUST use job_scores table** from Story 4b.2 for storage

### Previous Story Intelligence

**Story 4a.2 (Client Name Extraction - READY):**
- analysis.rs module with `analyze_job_post` function
- Uses Claude Haiku with cached system prompt
- JobAnalysis struct returned to frontend
- Integration pattern: Extend existing function for client quality (recommended)

**Story 4b.2 (Skills Match Calculation - ENHANCED):**
- job_scores table schema with client_quality_score INTEGER column
- ON CONFLICT(job_post_id) DO UPDATE pattern for upserts
- get_job_score command returns all score components

**Story 4a.3 (Key Skills Extraction - READY):**
- Extended analyze_job_post to include key_skills extraction (single API call)
- Pattern to follow: Add client_quality_score to same response

**Key Learnings:**
1. **Single API call pattern:** Stories 4a.2 and 4a.3 show extending analysis is better than separate calls
2. **Prompt caching:** System prompt is cached, reduces cost significantly
3. **Integer scores:** Use INTEGER (0-100) not REAL for quality scores (discrete, not continuous)

### Prompt Engineering for Client Quality Inference

**System Prompt Extension (add to existing analysis.rs cached prompt):**

```
## Client Quality Score (0-100 scale)

Estimate the client's quality based on signals in the job post. Return an integer from 0-100.

### Scoring Guidelines:

**High Quality (80-100):**
- Mentions: "verified payment method", "payment verified", "100% hire rate", "$XX,XXX+ spent on Upwork"
- Well-written, specific requirements, professional tone
- Detailed project description with clear scope
- Realistic timeline and budget expectations
- Mentions previous successful hires or reviews

**Medium Quality (60-79):**
- Some specificity but lacks detail
- Professional but generic language
- Reasonable expectations
- No major red flags

**Low Quality (0-59):**
- "0 hires", "no hire history", "new to Upwork"
- Vague requirements: "I need a website", "looking for expert"
- Red flags: "URGENT!!!", "ASAP needed", "very low budget", "work for exposure"
- Poor grammar, copy-pasted template, demanding tone
- Unrealistic expectations: "need full app in 2 days for $50"

### Hard Rules:
- If "0 hires" explicitly mentioned → score 45 (override inference)
- If no clear signals → default 65 (neutral assumption)

### Output Format:
Return "client_quality_score": <integer 0-100> in JSON response.
```

**Few-Shot Examples:**

```json
Example 1 (High Quality):
Input: "I'm looking for a React developer for a 3-month project. Budget: $5,000-$8,000. I've completed 15 projects on Upwork with a 100% hire rate and verified payment. Need someone who can start next week and work 20-30 hrs/week."
Output: { "client_quality_score": 90 }

Example 2 (Medium Quality):
Input: "Need a logo designer for my startup. Budget is flexible. Looking for someone creative with good portfolio."
Output: { "client_quality_score": 70 }

Example 3 (Low Quality):
Input: "URGENT!!! Need website ASAP. Very low budget. 0 hires but serious client."
Output: { "client_quality_score": 45 }
```

### Algorithm Implementation

**Client Quality Estimation Flow:**

```rust
// In analysis.rs, extend analyze_job_post function

pub struct JobAnalysis {
    pub client_name: Option<String>,
    pub key_skills: Vec<String>,
    pub client_quality_score: Option<i32>,  // NEW in Story 4b.3
}

// Extend prompt to include client quality scoring
let system_prompt = r#"
... existing client name and skills extraction prompt ...

## Client Quality Score (0-100 scale)
... scoring guidelines from above ...
"#;

// Parse response
let response_json: Value = serde_json::from_str(&response_text)?;
let client_quality_score = response_json["client_quality_score"].as_i64().map(|v| v as i32);

// Apply hard rules
let final_score = if job_post_text.to_lowercase().contains("0 hires") {
    Some(45)  // Force red flag score
} else {
    client_quality_score.or(Some(65))  // Default to 65 if null
};

// Store in job_scores table
conn.execute(
    "INSERT INTO job_scores (job_post_id, client_quality_score) VALUES (?, ?)
     ON CONFLICT(job_post_id) DO UPDATE SET client_quality_score = excluded.client_quality_score",
    params![job_post_id, final_score],
)?;
```

**Score Interpretation:**
- **85-100:** Excellent client — verified payment, high hire rate, professional
- **80-84:** Very good client — most positive signals, minor concerns
- **70-79:** Good client — generally positive, some unknowns
- **60-69:** Neutral client — no strong signals either way, default assumption
- **50-59:** Caution advised — some red flags, vague post, new client
- **40-49:** High risk — "0 hires", urgent demands, unrealistic expectations
- **0-39:** Severe red flags — multiple risk indicators, likely problematic

### Project Structure Notes

**Files to Modify:**
- `upwork-researcher/src-tauri/src/analysis.rs` — Extend analyze_job_post to include client_quality_score
- `upwork-researcher/src-tauri/src/lib.rs` — Update JobAnalysis struct, extend database storage after analysis
- `upwork-researcher/src/components/JobAnalysisDisplay.tsx` — Add client quality display

**Files to Reference:**
- `upwork-researcher/src-tauri/src/analysis.rs` — Story 4a.2 client name extraction patterns
- `upwork-researcher/src-tauri/migrations/V8__add_job_scores_table.sql` — Story 4b.2 schema (client_quality_score column)

**No New Files Needed:**
- Extends existing analysis pipeline
- Uses existing job_scores table
- Uses existing JobAnalysisDisplay component

### Inference Model Limitations

**Important Caveats:**
1. **No real Upwork data:** Score is inferred from job post text only, NOT actual client metrics
2. **Heuristic-based:** LLM guesses based on language patterns, can be fooled by well-written scam posts
3. **Conservative bias:** Red flags weighted heavily to minimize false negatives (better to skip a good job than take a bad one)
4. **Self-reported signals:** "100% hire rate" in post text ≠ verified Upwork badge (client could lie)

**User Education:**
- Tooltip clearly states "Estimated based on job post signals"
- Not presented as ground truth, but as a screening heuristic
- Users should still apply their own judgment

**Why This Approach:**
- Zero cost alternative to Upwork API (which doesn't exist for freelancers)
- Provides value even with imperfect inference
- Fast (<3s latency) vs manual analysis (30+ seconds reading post)
- Helps users quickly triage 10+ jobs and focus on best opportunities

### Color Coding Rationale

**Why Green/Yellow/Red Thresholds:**
- **Green (≥80):** High confidence — multiple positive signals, worth immediate attention
- **Yellow (60-79):** Moderate confidence — proceed with caution, no major red flags but limited info
- **Red (<60):** High risk — avoid unless desperate, multiple red flags or "0 hires"

**Threshold Calibration:**
- 80+ threshold is intentionally high (top 20% of jobs) to focus user on best opportunities
- 60 threshold for red is conservative — assumes neutral clients are "medium quality" not "low quality"
- Hard rule at 45 for "0 hires" ensures automatic red flag

### UX Flow Example

**User Journey:**
1. **User analyzes job post** → Stories 4a.1-4a.4 extract client name, skills, hidden needs
2. **Analysis includes client quality** → Claude Haiku processes job post, infers quality score
3. **Score stored** → INSERT INTO job_scores (client_quality_score = 85)
4. **Frontend displays** → "Client Quality: 85" in green near skills match percentage
5. **User hovers score** → Tooltip: "Estimated quality based on job post signals. 80+ = high quality, 60-79 = medium, <60 = high risk"
6. **User sees green** → Interprets as "safe to apply, high-quality client likely"

**Edge Case: "0 Hires" Detected:**
1. **Job post mentions** → "I'm new to Upwork with 0 hires but looking for long-term partner"
2. **Hard rule triggers** → client_quality_score overridden to 45 (regardless of LLM inference)
3. **Frontend displays** → "Client Quality: 45" in red with warning badge "⚠️ High risk client"
4. **User sees red** → Immediately cautious, may skip or apply extra scrutiny

### Security Considerations

**Data Privacy:**
- Client quality estimation happens via Anthropic API (job post text sent, score returned)
- No PII transmitted beyond what's in the job post itself
- Score stored locally in encrypted database

**Prompt Injection Risk:**
- Job posts are user-controlled text (copy-pasted by user)
- BUT prompt is asking for structured score (0-100 integer), not free text generation
- Risk is low: worst case, LLM returns biased score, not harmful output
- Mitigation: Hard rules override LLM (e.g., "0 hires" → 45)

**Bias Considerations:**
- LLM may have biases (e.g., penalizing non-native English speakers for grammar)
- Conservative red flag weighting may cause false negatives (reject good jobs)
- Mitigation: Clearly communicate "estimated" nature, encourage user judgment

### Testing Strategy

**Backend Tests:**
- Test high-quality job post → score ≥80
- Test medium-quality job post → score 60-79
- Test low-quality job post → score <60
- Test "0 hires" hard rule → score forced to 45
- Test minimal post → default 65
- Test score storage in database

**Frontend Tests:**
- Test green color display for ≥80
- Test yellow color display for 60-79
- Test red color + warning badge for <60
- Test null handling → "Not available"
- Test tooltip content

**Integration Tests:**
- Test end-to-end analysis → client name + skills + quality score returned
- Test score persistence across app restarts
- Test score display alongside skills match (Story 4b.2)

### Future Enhancements (Post-MVP)

**Machine Learning Model (Epic 7+):**
- Train classifier on real Upwork job outcomes (hired/not hired, client satisfaction)
- Replace heuristic LLM inference with ML model
- Features: post length, specificity score, sentiment, readability metrics

**User Feedback Loop (Epic 7+):**
- After applying to job, user reports actual client quality experience
- "Was this client good/bad? Score: ___"
- Use feedback to calibrate scoring thresholds over time

**Confidence Intervals (Epic 7+):**
- Display: "Client Quality: 85 ± 10" (confidence band)
- More signals → tighter interval, fewer signals → wider interval
- Helps users understand score uncertainty

### References

- [Source: epics-stories.md#Epic 4b: Job Scoring & Pipeline Management / Story 4b.3]
- [Source: prd.md#FR-4: Weighted Job Scoring]
- [Source: architecture.md#AR-4: Claude Haiku for Analysis]
- [Source: architecture.md#AR-5: Prompt Caching]
- [Source: prd.md#NFR-6: AI Streaming Start <1.5s]
- [Source: prd.md#NFR-4: UI Response <100ms]
- [Source: ux-design-specification.md#UX-1: Dark Mode]
- [Source: Story 4a.2: Client Name Extraction]
- [Source: Story 4b.2: Skills Match Percentage Calculation]

## Dev Agent Record

### Agent Model Used
- (Pending implementation)

### Implementation Summary
- (Pending implementation)

### Deferred Work
- ML-based client quality classifier (requires training data)
- User feedback loop for score calibration
- Confidence intervals for score uncertainty

### Acceptance Criteria Status
- ⏳ **AC-1:** Pending implementation
- ⏳ **AC-2:** Pending implementation
- ⏳ **AC-3:** Pending implementation

### File List
- (Pending implementation)

## Change Log

- 2026-02-06: Story enhanced with comprehensive dev context — SM Agent (Bob)
  - Added comprehensive prompt engineering template with scoring guidelines
  - Added few-shot examples for LLM client quality inference
  - Added Tasks/Subtasks breakdown (5 tasks, 30+ subtasks)
  - Added hard rules: "0 hires" → force score 45, no signals → default 65
  - Added integration strategy: extend analyze_job_post (single API call, lower cost)
  - Added score interpretation guide (0-100 scale with risk levels)
  - Added Dev Notes: AR/NFR/UX references, inference limitations, testing strategy
  - Added future enhancements: ML classifier, user feedback loop, confidence intervals
  - **Status: ready-for-dev — all context provided, depends on 4a.2 + 4b.2**

- 2026-02-05: Story created by sprint-planning workflow
