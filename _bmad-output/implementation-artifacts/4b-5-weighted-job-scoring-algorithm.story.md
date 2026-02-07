---
status: ready-for-dev
---

# Story 4b.5: Weighted Job Scoring Algorithm

## Story

As a freelancer,
I want an overall job score combining multiple factors,
So that I can quickly prioritize which jobs to pursue.

## Acceptance Criteria

1. **Given** skills match, client quality, and budget alignment are calculated
   **When** overall score is computed
   **Then** the system uses weighted formula:
   - Skills match: 40% weight
   - Client quality: 40% weight
   - Budget alignment: 20% weight

2. **And** final color flag is determined by COMPONENT thresholds (not weighted average):
   - **Green:** skills_match ≥ 75 AND client_quality ≥ 80
   - **Yellow:** skills_match 50-74 OR client_quality 60-79 (and not Red)
   - **Red:** skills_match < 50 OR client_quality < 60 OR 0-hire client

3. **And** I see overall score (0-100) with color flag

4. **And** score recalculates when any component changes (skills updated, new analysis, rate changed)

## Tasks / Subtasks

- [ ] Task 1: Rust scoring engine (AC: #1, #2)
  - [ ] 1.1 Create `src-tauri/src/scoring.rs` module with `calculate_overall_score()` and `determine_color_flag()`
  - [ ] 1.2 Implement weighted formula: `(skills * 0.4) + (client_quality * 0.4) + (budget * 0.2)`
  - [ ] 1.3 Implement color flag logic using component thresholds (NOT weighted average)
  - [ ] 1.4 Handle null/missing components (see Dev Notes)
  - [ ] 1.5 Unit tests for all scoring scenarios (see Testing Requirements)

- [ ] Task 2: Database persistence (AC: #1, #4)
  - [ ] 2.1 Add `color_flag TEXT` column to `job_scores` table (new migration)
  - [ ] 2.2 Implement `upsert_overall_score()` in `db/queries/job_scores.rs` — updates `overall_score` + `color_flag`
  - [ ] 2.3 Write DB persistence tests

- [ ] Task 3: Tauri commands (AC: #3, #4)
  - [ ] 3.1 Register `calculate_overall_job_score(job_post_id)` command — orchestrates: read components → calculate → store → return
  - [ ] 3.2 Register `recalculate_all_scores()` command — bulk recalc when user updates skills/rates
  - [ ] 3.3 Extend existing `get_job_score(job_post_id)` to include `overall_score` + `color_flag` in response

- [ ] Task 4: Frontend score display (AC: #3)
  - [ ] 4.1 Create `JobScoreBadge.tsx` component — renders overall score with color flag
  - [ ] 4.2 Add `JobScoreBadge.css` with Green/Yellow/Red/Gray states
  - [ ] 4.3 Integrate into `JobAnalysisDisplay` component (below individual component scores)
  - [ ] 4.4 Frontend tests for color rendering at threshold boundaries

- [ ] Task 5: Recalculation triggers (AC: #4)
  - [ ] 5.1 After `add_user_skill` / `remove_user_skill` → call `recalculate_all_scores()`
  - [ ] 5.2 After `set_user_hourly_rate` / `set_user_project_rate_min` → call `recalculate_all_scores()`
  - [ ] 5.3 After job analysis completes → call `calculate_overall_job_score(job_post_id)`

## Dev Notes

### Critical: Color Flag vs Weighted Score

The **weighted average** (`overall_score`) and the **color flag** serve DIFFERENT purposes:
- `overall_score` (0-100) → used for **sorting** in job queue (Story 4b-9)
- `color_flag` (green/yellow/red/gray) → used for **visual classification** per FR-4

Color flag uses AND/OR logic on INDIVIDUAL components, NOT the weighted average:
```
Green: skills_match >= 75.0 AND client_quality >= 80
Yellow: (skills_match >= 50.0 AND skills_match < 75.0) OR (client_quality >= 60 AND client_quality < 80)
        AND NOT Red
Red: skills_match < 50.0 OR client_quality < 60 OR is_zero_hire_client
```

Budget alignment does NOT affect color flag — only the weighted score.

### Null/Missing Component Handling

| Scenario | overall_score | color_flag |
|----------|--------------|------------|
| All 3 components present | Weighted calc | Component threshold logic |
| Skills match = None | None | "gray" (display: "Configure skills") |
| Client quality = None | Use default 65 | Treat as Yellow-range |
| Budget alignment = None | Calculate with 0 for budget term | Normal color logic |
| 0-hire client detected | Normal calc | Force "red" regardless of score |

`skills_match` is the **required baseline** — if missing, overall score cannot be computed.

### Zero-Hire Client Detection

Story 4b-3 sets `client_quality_score` and may detect "0 hires" in the LLM analysis. The `0-hire` signal needs to be persisted. Options:
- Check if `client_quality_score <= 45` (4b-3 forces score to 45 for 0-hire clients)
- OR add `is_zero_hire BOOLEAN DEFAULT 0` to `job_scores` migration

Recommended: Use the score threshold (`<= 45`) to infer 0-hire, avoiding schema change. Document this convention clearly.

### Scoring Algorithm (Rust)

```rust
pub struct ScoringResult {
    pub overall_score: Option<f64>,
    pub color_flag: String, // "green", "yellow", "red", "gray"
}

pub fn calculate_overall_score(
    skills_match: Option<f64>,      // 0.0-100.0
    client_quality: Option<i32>,    // 0-100
    budget_alignment: Option<i32>,  // 0-100
) -> ScoringResult {
    // 1. Check required baseline
    let skills = match skills_match {
        Some(s) => s,
        None => return ScoringResult { overall_score: None, color_flag: "gray".into() },
    };

    // 2. Default missing components
    let quality = client_quality.unwrap_or(65) as f64;
    let budget = budget_alignment.unwrap_or(0) as f64;

    // 3. Weighted calculation
    let score = (skills * 0.4) + (quality * 0.4) + (budget * 0.2);
    let score = (score * 10.0).round() / 10.0; // 1 decimal place

    // 4. Color flag from component thresholds
    let is_zero_hire = client_quality.map_or(false, |q| q <= 45);
    let flag = determine_color_flag(skills, client_quality.unwrap_or(65), is_zero_hire);

    ScoringResult { overall_score: Some(score), color_flag: flag }
}

pub fn determine_color_flag(skills_match: f64, client_quality: i32, is_zero_hire: bool) -> String {
    if skills_match < 50.0 || client_quality < 60 || is_zero_hire {
        "red".into()
    } else if skills_match >= 75.0 && client_quality >= 80 {
        "green".into()
    } else {
        "yellow".into()
    }
}
```

### Project Structure Notes

**New files:**
- `src-tauri/src/scoring.rs` — Scoring engine (pure functions, no DB dependency)
- `src-tauri/migrations/V{next}__add_color_flag_to_job_scores.sql` — Schema addition
- `src/components/JobScoreBadge.tsx` + `.css` — Frontend badge

**Modified files:**
- `src-tauri/src/lib.rs` — Register new Tauri commands
- `src-tauri/src/db/queries/job_scores.rs` — Add upsert for overall_score + color_flag (if exists; otherwise create this file)
- `src/components/JobAnalysisDisplay.tsx` — Integrate JobScoreBadge

**Migration number:** Check existing migrations in `src-tauri/migrations/` and use the next sequential number. Stories 4b-2 and 4b-4 may create V8 migrations — ensure no conflicts. If V8 already exists, use V9.

### Database Migration

```sql
-- V{next}__add_color_flag_to_job_scores.sql
ALTER TABLE job_scores ADD COLUMN color_flag TEXT DEFAULT 'gray';
CREATE INDEX idx_job_scores_color_flag ON job_scores(color_flag);
```

Note: `overall_score` column already exists in `job_scores` table (created by Story 4b-2 migration). This migration only adds `color_flag`.

### Frontend Component Spec

**JobScoreBadge.tsx:**
```tsx
interface JobScoreBadgeProps {
  overallScore: number | null;
  colorFlag: "green" | "yellow" | "red" | "gray";
}
```

**Color mapping (dark mode):**
| Flag | Background | Text | Border |
|------|-----------|------|--------|
| green | rgba(34,197,94,0.15) | #22c55e | #22c55e |
| yellow | rgba(245,158,11,0.15) | #f59e0b | #f59e0b |
| red | rgba(239,68,68,0.15) | #ef4444 | #ef4444 |
| gray | rgba(107,114,128,0.15) | #6b7280 | #6b7280 |

**Display format:** `"Overall: 72.5 — Yellow"` with colored badge
**Accessibility:** `aria-label="Overall job score: 72.5 out of 100, Yellow priority"`, never color-only

### Architecture Compliance

- **AR-4:** No LLM call needed — this is pure calculation in Rust
- **NFR-4:** Calculation must complete in <10ms (simple arithmetic)
- **AR-1:** All scoring logic in Rust backend, React only displays results
- **Serde:** Use `#[serde(rename_all = "camelCase")]` on all structs crossing IPC boundary
- **Error handling:** `Result<ScoringResult, AppError>` — use existing `AppError` enum

### Testing Requirements

**Rust unit tests (in `scoring.rs`):**
- `test_perfect_score` — all 100s → score 100.0, flag "green"
- `test_zero_score` — all 0s → score 0.0, flag "red"
- `test_green_threshold` — skills=75, quality=80, budget=100 → flag "green"
- `test_yellow_skills_boundary` — skills=74.9, quality=80 → flag "yellow" (not green)
- `test_yellow_quality_boundary` — skills=75, quality=79 → flag "yellow"
- `test_red_skills` — skills=49.9, quality=90 → flag "red"
- `test_red_quality` — skills=90, quality=59 → flag "red"
- `test_red_zero_hire` — skills=90, quality=45 → flag "red" (0-hire override)
- `test_missing_skills` — skills=None → score=None, flag="gray"
- `test_missing_quality_defaults` — quality=None → defaults to 65
- `test_missing_budget_defaults` — budget=None → budget term contributes 0
- `test_rounding` — verify 1 decimal place rounding
- `test_weighted_formula` — verify exact: (67*0.4)+(85*0.4)+(90*0.2) = 26.8+34.0+18.0 = 78.8

**Frontend tests (in `JobScoreBadge.test.tsx`):**
- Renders green badge for green flag
- Renders yellow badge for yellow flag
- Renders red badge for red flag
- Renders gray badge for null score
- Displays score with 1 decimal place
- Has correct aria-label for accessibility
- Applies correct CSS class per color flag

### Dependencies

**Requires completed (or stubbed):**
- Story 4b-2: `job_scores` table with `skills_match_percentage`, `overall_score` columns
- Story 4b-3: `client_quality_score` populated in `job_scores`
- Story 4b-4: `budget_alignment_score` in `job_scores` OR `budget_alignment_pct` in `job_posts`

**Consumed by:**
- Story 4b-6: Scoring Breakdown UI reads `overall_score` + `color_flag` + component scores
- Story 4b-9: Job Queue sorts by `overall_score DESC`

### References

- [Source: _bmad-output/planning-artifacts/prd.md § FR-4] — Weighted scoring with Green/Yellow/Red flags
- [Source: _bmad-output/planning-artifacts/prd.md § FR-17] — Confidence scores with explanations
- [Source: _bmad-output/planning-artifacts/architecture.md § AR-4] — Claude Haiku for scoring (not needed here)
- [Source: _bmad-output/planning-artifacts/epics-stories.md § Epic 4b Story 5] — AC and technical notes
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md § Quality Score Badge] — Visual spec
- [Source: _bmad-output/implementation-artifacts/4b-2-skills-match-percentage-calculation.story.md] — job_scores table schema
- [Source: _bmad-output/implementation-artifacts/4b-3-client-quality-score-estimation.story.md] — Client quality patterns
- [Source: _bmad-output/implementation-artifacts/4b-4-budget-alignment-detection.story.md] — Budget alignment patterns

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
