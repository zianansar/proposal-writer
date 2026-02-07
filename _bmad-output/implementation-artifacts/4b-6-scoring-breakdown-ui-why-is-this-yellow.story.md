---
status: ready-for-dev
---

# Story 4b.6: Scoring Breakdown UI ("Why is this Yellow?")

## Story

As a freelancer,
I want to understand why a job received its color rating,
So that I can trust the scoring system.

## Acceptance Criteria

1. **Given** a job has been scored
   **When** I click on the color flag or overall score
   **Then** I see a detailed breakdown card expand inline below the score

2. **And** the breakdown displays all three component scores with:
   - Status icon (checkmark/warning/x)
   - Component name and score
   - Quality label (good/medium risk/poor)
   - Human-readable explanation of WHY

3. **And** the breakdown shows a contextual recommendation based on the score combination

4. **And** example display:
   ```
   Overall: Yellow (68%)
   Why Yellow?

   ✅ Skills Match: 75% (good) - You have 3/4 required skills
   ⚠️ Client Quality: 60% (medium risk) - Only 2 previous hires
   ✅ Budget: 90% (good) - $55/hr vs your $50/hr rate

   Recommendation: Proceed with caution. Client is new to Upwork.
   ```

5. **And** the breakdown is accessible via keyboard (Enter/Space to toggle, Escape to close)

## Tasks / Subtasks

- [ ] Task 1: Backend — scoring breakdown data endpoint (AC: #2)
  - [ ] 1.1 Create `get_scoring_breakdown(job_post_id)` Tauri command that returns all component data needed for the breakdown display
  - [ ] 1.2 Define `ScoringBreakdown` struct with component details + recommendation text
  - [ ] 1.3 Implement recommendation text generation logic (pure Rust, no LLM)
  - [ ] 1.4 Unit tests for breakdown assembly and recommendation logic

- [ ] Task 2: Frontend — ScoringBreakdown component (AC: #1, #2, #3, #4)
  - [ ] 2.1 Create `ScoringBreakdown.tsx` — expandable card with three metric rows + recommendation
  - [ ] 2.2 Create `ScoringBreakdown.css` — dark mode card, metric rows, expand/collapse animation
  - [ ] 2.3 Integrate click handler on `JobScoreBadge` to toggle breakdown visibility
  - [ ] 2.4 Frontend tests for rendering, interaction, and accessibility

- [ ] Task 3: Skill detail display (AC: #2)
  - [ ] 3.1 Query matched vs unmatched skills for the breakdown (show "You have 3/4 required skills")
  - [ ] 3.2 List matched skills with checkmarks, missing skills with X marks
  - [ ] 3.3 Handle edge cases: no user skills configured, no job skills detected

- [ ] Task 4: Budget detail display (AC: #2)
  - [ ] 4.1 Show comparison: "Job: $55/hr vs Your rate: $50/hr"
  - [ ] 4.2 Handle budget types (hourly, fixed, unknown, mismatch)

- [ ] Task 5: Accessibility and keyboard support (AC: #5)
  - [ ] 5.1 Click OR Enter/Space on score badge toggles breakdown
  - [ ] 5.2 Escape closes breakdown and returns focus to badge
  - [ ] 5.3 aria-expanded, aria-controls, aria-labelledby attributes
  - [ ] 5.4 Screen reader announces breakdown content when opened

## Dev Notes

### Design Decision: Inline Expandable Card (NOT Modal)

The breakdown renders as an **inline expandable card** below the `JobScoreBadge`, not as a modal. Rationale:
- AC says "click on color flag or score" → toggle breakdown
- UX spec's thoroughness-first principle means detail should be easy to access
- Avoids modal fatigue (project already has 3+ modals)
- Follows the existing expandable pattern from `SafetyWarningModal` flagged sentences

**Interaction flow:**
1. User sees overall score badge (e.g., "72.5 — Yellow")
2. Clicks badge → card slides open below with 200ms ease-in-out animation
3. Card shows 3 metric rows + recommendation
4. Click badge again → card collapses
5. State tracked locally (no persistence needed)

### Backend: ScoringBreakdown Struct

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoringBreakdown {
    // Overall
    pub overall_score: Option<f64>,
    pub color_flag: String,

    // Skills Match component
    pub skills_match_pct: Option<f64>,
    pub skills_matched_count: i32,
    pub skills_total_count: i32,
    pub skills_matched_list: Vec<String>,   // ["React", "TypeScript"]
    pub skills_missing_list: Vec<String>,   // ["Docker"]

    // Client Quality component
    pub client_quality_score: Option<i32>,
    pub client_quality_signals: String,     // "Only 2 previous hires"

    // Budget Alignment component
    pub budget_alignment_pct: Option<i32>,
    pub budget_display: String,             // "$55/hr vs your $50/hr rate"
    pub budget_type: String,                // "hourly", "fixed", "unknown"

    // Recommendation
    pub recommendation: String,             // "Proceed with caution. Client is new to Upwork."
}
```

### Recommendation Text Logic (Pure Rust)

Generate recommendation based on color flag and component analysis:

```rust
fn generate_recommendation(color_flag: &str, skills_pct: Option<f64>, quality: Option<i32>, budget_pct: Option<i32>) -> String {
    match color_flag {
        "green" => "Strong match. This job aligns well with your skills and the client looks reliable.".into(),
        "yellow" => {
            // Identify the weakest component and call it out
            let mut reasons = Vec::new();
            if let Some(s) = skills_pct {
                if s < 75.0 { reasons.push("skills gap"); }
            }
            if let Some(q) = quality {
                if q < 80 { reasons.push("client history"); }
            }
            if let Some(b) = budget_pct {
                if b < 100 { reasons.push("budget"); }
            }
            format!("Proceed with caution. Review {} before applying.", reasons.join(" and "))
        }
        "red" => {
            if quality.map_or(false, |q| q <= 45) {
                "High risk. Client has no hire history — proceed only if the project is compelling.".into()
            } else {
                "Low priority. Significant gaps in skills match or client quality.".into()
            }
        }
        _ => "Insufficient data to assess. Configure your skills and rates in Settings.".into(),
    }
}
```

### Client Quality Signals

Story 4b-3 uses Claude Haiku to estimate quality but does NOT persist the reasoning text. The breakdown needs a human-readable explanation for the client quality score.

**Options (pick one during implementation):**
1. **Derive from score range** (simpler, no schema change):
   - Score ≥ 80: "Client appears reliable with good hire history"
   - Score 60-79: "Limited client history, moderate confidence"
   - Score < 60: "New or problematic client signals detected"
   - Score ≤ 45: "Client has 0 hires or significant red flags"
2. **Store reasoning from LLM** (better UX, requires 4b-3 schema addition):
   - Add `client_quality_reasoning TEXT` column to `job_scores`
   - Populate during analysis in Story 4b-3

**Recommended:** Option 1 for this story (no cross-story schema change). Option 2 can be added as enhancement later.

### Component Quality Labels and Icons

| Component | Score Range | Icon | Label | Color |
| --- | --- | --- | --- | --- |
| Skills Match | ≥75% | ✅ | "good" | #22c55e |
| Skills Match | 50-74% | ⚠️ | "moderate" | #f59e0b |
| Skills Match | <50% | ❌ | "poor" | #ef4444 |
| Client Quality | ≥80 | ✅ | "reliable" | #22c55e |
| Client Quality | 60-79 | ⚠️ | "medium risk" | #f59e0b |
| Client Quality | <60 | ❌ | "high risk" | #ef4444 |
| Budget | ≥100% | ✅ | "good" | #22c55e |
| Budget | 70-99% | ⚠️ | "below rate" | #f59e0b |
| Budget | <70% | ❌ | "low" | #ef4444 |
| Budget | unknown | — | "unknown" | #6b7280 |

### Frontend Component Spec

**ScoringBreakdown.tsx:**

```tsx
interface ScoringBreakdownProps {
  breakdown: ScoringBreakdown; // from Tauri command
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Layout:**

```
┌─────────────────────────────────────────────┐
│ Why Yellow?                                  │
│                                              │
│ ✅ Skills Match: 75% (good)                  │
│    You have 3/4 required skills              │
│    Matched: React, TypeScript                │
│    Missing: Docker                           │
│                                              │
│ ⚠️ Client Quality: 60 (medium risk)          │
│    Limited client history, moderate confidence│
│                                              │
│ ✅ Budget: 90% (good)                        │
│    $55/hr vs your $50/hr rate                │
│                                              │
│ ─────────────────────────────────────────── │
│ 💡 Proceed with caution. Review client       │
│    history before applying.                  │
└─────────────────────────────────────────────┘
```

**CSS:**

```css
.scoring-breakdown {
  background: #1e1e1e;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
  animation: slideDown 200ms ease-in-out;
}

.scoring-breakdown__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid #2a2a2a;
}

.scoring-breakdown__metric:last-of-type {
  border-bottom: none;
}

.scoring-breakdown__recommendation {
  padding-top: 12px;
  border-top: 1px solid #374151;
  color: #a3a3a3;
  font-size: 14px;
  line-height: 1.5;
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}
```

### Integration with JobScoreBadge

The `JobScoreBadge` (from Story 4b-5) needs a small modification:
- Add `onClick` handler to toggle breakdown
- Add `aria-expanded` attribute
- Add chevron icon that rotates on expand

```tsx
// In JobScoreBadge.tsx — add click handler
<button
  className="job-score-badge"
  onClick={onToggle}
  aria-expanded={isExpanded}
  aria-controls="scoring-breakdown"
  aria-label={`Overall job score: ${overallScore} out of 100, ${colorFlag} priority. Click for breakdown.`}
>
  <span className="job-score-badge__score">{overallScore}</span>
  <span className="job-score-badge__flag">{colorFlag}</span>
  <span className={`job-score-badge__chevron ${isExpanded ? 'rotated' : ''}`}>▼</span>
</button>
```

### Existing Patterns to Follow

**Card pattern** (from `App.css .settings-section`):
- `background-color: #1a1a1a; border: 1px solid #555; border-radius: 8px; padding: 1.5rem;`

**Expandable pattern** (from `SafetyWarningModal` flagged sentences):
- Nested cards with border-bottom separators
- Smooth expand animation
- Dark sub-background (#262626)

**Badge colors** (from `App.css`):
- Success: `rgba(92, 184, 92, 0.15)` bg + `#5cb85c` text
- Warning: `rgba(251, 191, 36, 0.15)` bg + `#fbbf24` text
- Error: `rgba(239, 68, 68, 0.15)` bg + `#ef4444` text

**Accessibility** (from `EncryptionDetailsModal`):
- Focus trap when expanded
- Escape to close
- `aria-modal`, `role="region"`, `aria-labelledby`

### Project Structure Notes

**New files:**

- `src/components/ScoringBreakdown.tsx` — Breakdown card component
- `src/components/ScoringBreakdown.css` — Styles
- `src/components/ScoringBreakdown.test.tsx` — Tests

**Modified files:**

- `src-tauri/src/scoring.rs` — Add `generate_recommendation()` and `get_scoring_breakdown()` logic
- `src-tauri/src/lib.rs` — Register `get_scoring_breakdown` Tauri command
- `src/components/JobScoreBadge.tsx` — Add click handler, aria-expanded, chevron icon
- `src/components/JobScoreBadge.css` — Add chevron rotation styles
- `src/components/JobAnalysisDisplay.tsx` — Render `ScoringBreakdown` below `JobScoreBadge`

### Architecture Compliance

- **AR-4:** No LLM call needed — pure display of pre-calculated data
- **NFR-4:** Rendering must be <100ms (just reading from state, no computation)
- **FR-17:** Rationalized scoring with human-readable explanations — this story fulfills it
- **NFR-14:** Accessibility — keyboard nav, screen reader, color independence (icons + text + color)
- **Serde:** `#[serde(rename_all = "camelCase")]` on `ScoringBreakdown` struct

### Testing Requirements

**Rust unit tests (in `scoring.rs`):**

- `test_recommendation_green` — green flag returns positive recommendation
- `test_recommendation_yellow_skills_gap` — yellow with skills < 75 mentions "skills gap"
- `test_recommendation_yellow_client` — yellow with quality < 80 mentions "client history"
- `test_recommendation_red_zero_hire` — red with quality ≤ 45 mentions "no hire history"
- `test_recommendation_red_general` — red general case
- `test_recommendation_gray` — gray returns "insufficient data" message
- `test_breakdown_assembly` — full breakdown struct assembled correctly from components

**Frontend tests (in `ScoringBreakdown.test.tsx`):**

- Renders all three metric rows with correct icons and labels
- Displays correct quality labels at threshold boundaries (green/yellow/red)
- Shows matched and missing skills lists
- Shows budget comparison text
- Shows recommendation text
- Expand/collapse animation toggles on click
- Keyboard: Enter/Space toggles, Escape closes
- `aria-expanded` attribute updates on toggle
- Screen reader: correct aria-labels on each metric
- Handles null scores gracefully (shows "Not available" or "Configure in Settings")

### Dependencies

**Requires completed:**

- Story 4b-5: `JobScoreBadge` component to attach click handler to
- Story 4b-5: `overall_score`, `color_flag` in `job_scores` table
- Story 4b-2: `skills_match_percentage` in `job_scores` + skill lists in `job_skills`/`user_skills`
- Story 4b-3: `client_quality_score` in `job_scores`
- Story 4b-4: Budget data in `job_posts` (budget_min, budget_max, budget_type, budget_alignment_pct)

**Consumed by:**

- Story 4b-9: Job Queue — breakdown may be accessible from queue item click
- Story 4b-10: Report Bad Scoring — may link from breakdown to report form

### References

- [Source: _bmad-output/planning-artifacts/prd.md § FR-17] — Rationalized scoring with human-readable explanations
- [Source: _bmad-output/planning-artifacts/prd.md § Journey 5.1] — Score confidence reasons
- [Source: _bmad-output/planning-artifacts/epics-stories.md § Epic 4b Story 6] — AC and example display
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md § Component 6 Quality Metrics Card] — Card spec
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md § Design Opportunity 2] — Honest Probabilistic Guidance
- [Source: _bmad-output/planning-artifacts/epics.md § Round 3 Marcus] — Transparency requirements
- [Source: _bmad-output/implementation-artifacts/4b-5-weighted-job-scoring-algorithm.story.md] — JobScoreBadge to extend
- [Source: _bmad-output/implementation-artifacts/4b-2-skills-match-percentage-calculation.story.md] — Skills data structures
- [Source: _bmad-output/implementation-artifacts/4b-3-client-quality-score-estimation.story.md] — Client quality patterns
- [Source: _bmad-output/implementation-artifacts/4b-4-budget-alignment-detection.story.md] — Budget alignment data

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
