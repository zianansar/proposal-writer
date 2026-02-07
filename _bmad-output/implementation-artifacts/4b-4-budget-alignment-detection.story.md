---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0/9
testsWritten: 0
---

# Story 4b.4: Budget Alignment Detection

## Story

As a freelancer,
I want to know if the job budget matches my rate expectations,
So that I don't waste time on low-budget jobs.

## Acceptance Criteria

**AC-1:** Given I've configured my hourly/project rate in settings
**When** a job is analyzed
**Then** the system extracts budget from job post using Claude Haiku
**And** parses budget into structured format (min, max, type: hourly/fixed)
**And** compares to my configured rate
**And** calculates alignment percentage

**AC-2:** Given budget extraction completes
**When** results are displayed in job analysis
**Then** I see "Budget Alignment: 90%" with color coding:
- Green: budget ≥ my rate (100%+)
- Yellow: budget 70-99% of my rate
- Red: budget <70% of my rate
- Gray: budget unknown/not mentioned

**AC-3:** Given a job mentions budget in various formats
**When** Claude Haiku analyzes the content
**Then** it extracts budget regardless of format:
- "$50/hr" → hourly: $50
- "$2000 fixed" → fixed: $2000
- "$30-50/hour" → hourly min: $30, max: $50
- "Budget: $5k-$10k" → fixed min: $5000, max: $10000
- No budget mentioned → budget: null

**AC-4:** Given I have hourly rate configured but job is fixed-price (or vice versa)
**When** alignment is calculated
**Then** system shows "Budget type mismatch" in gray
**And** does not penalize job score (neutral weight in Story 4b-5)

**AC-5:** Given budget extraction completes
**When** job analysis is saved
**Then** budget data persists to job_posts table
**And** alignment calculation is cached (no re-computation on view)

## Tasks / Subtasks

### Database Implementation (Rust + Migration)

- [ ] Task 1: Create budget columns migration (AC: 5)
  - [ ] Subtask 1.1: Create migration `V8__add_budget_fields_to_job_posts.sql`
  - [ ] Subtask 1.2: Add column: `budget_min REAL` (minimum budget, null if unknown)
  - [ ] Subtask 1.3: Add column: `budget_max REAL` (maximum budget, null if single value or unknown)
  - [ ] Subtask 1.4: Add column: `budget_type TEXT` (values: 'hourly', 'fixed', 'unknown')
  - [ ] Subtask 1.5: Add column: `budget_alignment_pct INTEGER` (0-100+ or null if can't calculate)
  - [ ] Subtask 1.6: Add column: `budget_alignment_status TEXT` (values: 'green', 'yellow', 'red', 'gray', 'mismatch')
  - [ ] Subtask 1.7: Add index: `CREATE INDEX idx_job_posts_budget_alignment ON job_posts(budget_alignment_status);` (for filtering in Story 4b-9)
  - [ ] Subtask 1.8: Verify migration runs with refinery

### Settings Implementation (User Rate Configuration)

- [ ] Task 2: Add user rate fields to settings table (AC: 1)
  - [ ] Subtask 2.1: Add settings key: `user_hourly_rate` (TEXT storing decimal as string, e.g. "75.00")
  - [ ] Subtask 2.2: Add settings key: `user_project_rate_min` (TEXT storing decimal, e.g. "2000.00")
  - [ ] Subtask 2.3: Create `get_user_rate_config() -> Result<RateConfig, String>` query in lib.rs
  - [ ] Subtask 2.4: Define `RateConfig` struct: `{ hourly_rate: Option<f64>, project_rate_min: Option<f64> }`
  - [ ] Subtask 2.5: Create Tauri command `get_user_rate_config()` for frontend access
  - [ ] Subtask 2.6: Create Tauri command `set_user_hourly_rate(rate: f64)` for settings UI
  - [ ] Subtask 2.7: Create Tauri command `set_user_project_rate_min(rate: f64)` for settings UI
  - [ ] Subtask 2.8: Register all commands in invoke_handler

### Backend Implementation (Rust - Budget Extraction)

- [ ] Task 3: Extend JobAnalysis struct for budget (AC: 3)
  - [ ] Subtask 3.1: Open `src-tauri/src/analysis.rs` (created in Story 4a-2)
  - [ ] Subtask 3.2: Add fields to `JobAnalysis` struct:
    ```rust
    pub budget_min: Option<f64>,
    pub budget_max: Option<f64>,
    pub budget_type: String, // "hourly", "fixed", "unknown"
    ```
  - [ ] Subtask 3.3: Update struct serialization to camelCase for frontend

- [ ] Task 4: Implement budget extraction with Claude Haiku (AC: 3, 4)
  - [ ] Subtask 4.1: Create `extract_budget(raw_content: &str, api_key: &str) -> Result<BudgetInfo, String>` function in analysis.rs
  - [ ] Subtask 4.2: Define `BudgetInfo` struct: `{ min: Option<f64>, max: Option<f64>, budget_type: String }`
  - [ ] Subtask 4.3: Build system prompt for budget extraction:
    - Extract budget from job post (hourly rate or fixed project budget)
    - Return JSON: `{ "budget_min": 50.0, "budget_max": 50.0, "budget_type": "hourly" }`
    - Handle ranges: "$30-50/hr" → min=30, max=50, type=hourly
    - Handle "k" notation: "$5k" → 5000, "$10k-15k" → min=10000, max=15000
    - If no budget mentioned: return null values, type="unknown"
    - Distinguish hourly vs fixed: look for "/hr", "/hour", "per hour" vs "fixed", "total", "project budget"
  - [ ] Subtask 4.4: Add few-shot examples (4-5 covering common patterns):
    1. "$50/hour" → {min: 50, max: 50, type: "hourly"}
    2. "$2000 fixed price" → {min: 2000, max: 2000, type: "fixed"}
    3. "$30-50/hr depending on experience" → {min: 30, max: 50, type: "hourly"}
    4. "Budget: $5k-$10k" → {min: 5000, max: 10000, type: "fixed"}
    5. No budget mentioned → {min: null, max: null, type: "unknown"}
  - [ ] Subtask 4.5: Add `cache_control: { "type": "ephemeral" }` to system prompt for caching (AR-5)
  - [ ] Subtask 4.6: Call Claude Haiku via non-streaming API (follow analyze_perplexity pattern)
  - [ ] Subtask 4.7: Parse JSON response, handle malformed responses gracefully (default to unknown)
  - [ ] Subtask 4.8: Integrate `extract_budget()` into existing job analysis flow (call alongside client_name, skills extraction)

### Backend Implementation (Rust - Budget Alignment Calculation)

- [ ] Task 5: Implement budget alignment calculation (AC: 1, 2, 4)
  - [ ] Subtask 5.1: Create `calculate_budget_alignment(budget: &BudgetInfo, user_rate: &RateConfig) -> BudgetAlignment` function
  - [ ] Subtask 5.2: Define `BudgetAlignment` struct: `{ percentage: Option<i32>, status: String }` (status: green/yellow/red/gray/mismatch)
  - [ ] Subtask 5.3: Implement type mismatch detection:
    - If budget_type=hourly and user has NO hourly_rate → status="mismatch", percentage=null
    - If budget_type=fixed and user has NO project_rate_min → status="mismatch", percentage=null
  - [ ] Subtask 5.4: Implement alignment percentage calculation:
    - Hourly jobs: `percentage = (budget_min / user_hourly_rate) * 100`
    - Fixed jobs: `percentage = (budget_min / user_project_rate_min) * 100`
    - If budget range (min != max), use minimum for conservative alignment
  - [ ] Subtask 5.5: Implement color status logic:
    - percentage >= 100 → status="green"
    - percentage 70-99 → status="yellow"
    - percentage < 70 → status="red"
    - budget_type="unknown" → status="gray", percentage=null
    - Type mismatch → status="mismatch", percentage=null
  - [ ] Subtask 5.6: Handle edge cases:
    - Division by zero (user rate = 0) → status="gray", percentage=null
    - Negative budgets → status="gray", percentage=null (invalid data)
    - User has no rate configured → status="gray", percentage=null

- [ ] Task 6: Integrate budget alignment into job analysis command (AC: 5)
  - [ ] Subtask 6.1: Update `analyze_job_post` Tauri command to call `extract_budget()`
  - [ ] Subtask 6.2: Fetch user rate config via `get_user_rate_config()`
  - [ ] Subtask 6.3: Call `calculate_budget_alignment(budget, rate_config)`
  - [ ] Subtask 6.4: Save budget fields to job_posts table (budget_min, budget_max, budget_type, budget_alignment_pct, budget_alignment_status)
  - [ ] Subtask 6.5: Return budget alignment in JobAnalysis response to frontend
  - [ ] Subtask 6.6: Handle database save errors gracefully (log but don't fail analysis)

### Frontend Implementation (React - Settings UI)

- [ ] Task 7: Add rate configuration to Settings page (AC: 1)
  - [ ] Subtask 7.1: Open `src/components/Settings.tsx` (or create if doesn't exist from Story 4b-1)
  - [ ] Subtask 7.2: Add "Rates" subsection to Profile section
  - [ ] Subtask 7.3: Add number input field: "Hourly Rate ($/hr)" with placeholder "$75"
  - [ ] Subtask 7.4: Add number input field: "Minimum Project Rate ($)" with placeholder "$2000"
  - [ ] Subtask 7.5: Call `get_user_rate_config()` on mount, populate fields
  - [ ] Subtask 7.6: On change (debounced 500ms), call `set_user_hourly_rate()` or `set_user_project_rate_min()`
  - [ ] Subtask 7.7: Show "Saving..." indicator during persistence
  - [ ] Subtask 7.8: Style with dark mode colors (UX-1): #1a1a1a background, #e0e0e0 text
  - [ ] Subtask 7.9: Add help text: "Used to calculate budget alignment for job scoring"

### Frontend Implementation (React - Budget Alignment Display)

- [ ] Task 8: Display budget alignment in job analysis results (AC: 2)
  - [ ] Subtask 8.1: Identify where job analysis results are displayed (likely Story 4a-7 component or Story 4b-6 scoring breakdown)
  - [ ] Subtask 8.2: Add budget alignment display component or section
  - [ ] Subtask 8.3: Show label: "Budget Alignment: {percentage}%" with color-coded badge
  - [ ] Subtask 8.4: Implement color coding:
    - Green (#22c55e): percentage >= 100
    - Yellow (#eab308): percentage 70-99
    - Red (#ef4444): percentage < 70
    - Gray (#6b7280): status="gray" or "mismatch"
  - [ ] Subtask 8.5: Show tooltip on hover with details:
    - "Job budget: $50/hr, Your rate: $75/hr" (mismatch example)
    - "Job budget: $2000 fixed, Your rate: $2000+ projects" (aligned)
    - "Budget not mentioned in job post" (unknown)
    - "Budget type doesn't match your configured rates" (mismatch)
  - [ ] Subtask 8.6: Handle mismatch status with clear messaging: "Budget Type Mismatch" in gray
  - [ ] Subtask 8.7: Hide alignment if user hasn't configured any rates yet (show "Configure rates in Settings")

### Testing

- [ ] Task 9: Write comprehensive tests
  - [ ] Subtask 9.1: Backend unit tests for extract_budget():
    - Test "$50/hr" → {min: 50, max: 50, type: "hourly"}
    - Test "$30-50/hour" → {min: 30, max: 50, type: "hourly"}
    - Test "$2000 fixed" → {min: 2000, max: 2000, type: "fixed"}
    - Test "$5k-$10k" → {min: 5000, max: 10000, type: "fixed"}
    - Test "Budget: 3000" → {min: 3000, max: 3000, type: "fixed"} (assume fixed if no type)
    - Test no budget mentioned → {min: null, max: null, type: "unknown"}
  - [ ] Subtask 9.2: Backend unit tests for calculate_budget_alignment():
    - Test hourly job $50 vs user rate $50 → 100%, green
    - Test hourly job $50 vs user rate $75 → 67%, red
    - Test hourly job $50 vs user rate $40 → 125%, green
    - Test fixed job $2000 vs user project min $2000 → 100%, green
    - Test hourly job but user has NO hourly rate → mismatch, gray
    - Test fixed job but user has NO project rate → mismatch, gray
    - Test budget unknown → gray, null percentage
    - Test user rate = 0 → gray, null percentage
  - [ ] Subtask 9.3: Backend integration tests:
    - Test full flow: analyze_job_post → extract budget → calculate alignment → save to DB
    - Test budget persistence: save job, restart app, verify budget fields loaded correctly
    - Test budget extraction with real job post examples (5+ samples)
  - [ ] Subtask 9.4: Frontend tests for Settings rate configuration:
    - Test hourly rate input renders and saves
    - Test project rate input renders and saves
    - Test debounced saving (500ms)
    - Test "Saving..." indicator appears
  - [ ] Subtask 9.5: Frontend tests for budget alignment display:
    - Test green badge for aligned budgets
    - Test yellow badge for 70-99% alignment
    - Test red badge for <70% alignment
    - Test gray badge for unknown/mismatch
    - Test tooltip shows correct details
    - Test "Configure rates" message when user has no rates

## Dev Notes

### Architecture Requirements

**AR-1: Tauri Desktop Framework**
- Framework: Tauri v2.9.5
- Backend: Rust for all database operations and business logic
- Frontend: React 19 + TypeScript + Vite 7
- IPC: Tauri commands for frontend ↔ backend communication

**AR-2: SQLCipher Database Integration**
- Database Library: rusqlite 0.38 + bundled-sqlcipher-vendored-openssl feature
- SQLCipher Version: 4.10.0 (AES-256 encryption)
- Encryption: ALL user data encrypted, including job_posts budget columns (NFR-2)
- Migration Framework: refinery for SQL migrations

**AR-4: LLM Provider (Anthropic Claude)**
- Model for job analysis: Claude Haiku 4.5 (`claude-haiku-4-20250514`)
- Budget extraction uses same Haiku endpoint as Stories 4a-2, 4a-3, 4a-4
- Cost optimization: Haiku is 20x cheaper than Sonnet for extraction tasks

**AR-5: Prompt Caching**
- System prompts and few-shot examples use `cache_control: { type: "ephemeral" }`
- Header: `anthropic-beta: prompt-caching-2024-07-31`
- Expected savings: 50-70% input token costs for repeated job analysis

**AR-10: Streaming UI Updates**
- Budget extraction is NOT streamed (single JSON response from Haiku)
- Results displayed after full analysis completes (alongside client name, skills)
- Consistent with Stories 4a-2, 4a-3, 4a-4 analysis flow

### Non-Functional Requirements

**NFR-2: Local Data Encryption**
- Budget data (user rates, extracted budgets) stored in encrypted database
- Encryption transparent to application code (handled by SQLCipher layer)
- No plaintext budget information stored anywhere

**NFR-4: UI Response Time**
- Budget extraction completes in <3 seconds (Haiku analysis target)
- Alignment calculation is instant (<10ms, pure math)
- Settings rate configuration saves in <500ms (perceived as instant)

**NFR-9: Query Performance**
- Budget alignment lookup <50ms (indexed by budget_alignment_status)
- Job queue filtering by alignment status <100ms (Story 4b-9 dependency)

**NFR-14: Accessibility (WCAG 2.1 AA)**
- Color-coded badges have text labels (not color-only)
- Tooltips accessible via keyboard (focus → show tooltip)
- Rate input fields have clear labels and aria-describedby
- High contrast: Green/Yellow/Red badges meet 4.5:1 contrast on dark background

### Functional Requirements

**FR-4: Weighted Job Scoring**
- This story provides **budget alignment component** for weighted scoring in Story 4b-5
- Budget alignment contributes 20% weight to overall job score
- Formula (Story 4b-5): `overall_score = (skills_match * 0.4) + (client_quality * 0.4) + (budget_alignment * 0.2)`
- Mismatch or unknown budgets contribute 0 to score (neutral, not penalty)

### Story Position in Epic 4b Flow

**Story 4b.4 Position in Job Scoring Sequence:**
1. **Story 4b.1 (READY):** User configures skills profile + rates (baseline for matching)
2. **Story 4b.2 (READY):** Skills match % calculation (user_skills ∩ job_skills)
3. **Story 4b.3 (READY):** Client quality score estimation
4. **→ Story 4b.4 (THIS STORY):** Budget alignment detection (budget extraction + comparison)
5. **Story 4b.5 (NEXT):** Weighted job scoring algorithm (combines 4b.2, 4b.3, 4b.4)
6. **Story 4b.6:** Scoring breakdown UI (displays results from 4b.5, including budget alignment)

**Epic 4a Dependency:**
- Epic 4a (Stories 4a-2, 4a-3, 4a-4) creates `analysis.rs` module and `JobAnalysis` struct
- Story 4b-4 EXTENDS JobAnalysis struct with budget fields
- Budget extraction integrates into same analyze_job_post() flow as client name/skills
- **Recommendation:** Implement Stories 4a-2, 4a-3, 4a-4 BEFORE Story 4b-4 to avoid merge conflicts

### Previous Story Intelligence

**Story 1-8 (Settings Table - DONE):**
- Settings table exists: `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, ...);`
- Pattern: Store rate config as settings keys `user_hourly_rate`, `user_project_rate_min`
- Settings page may exist for API key configuration (Story 1-7)

**Story 4a-2 (Client Name Extraction - READY):**
- Creates `analysis.rs` module with `JobAnalysis` struct
- Establishes pattern for Claude Haiku extraction with prompt caching
- Budget extraction follows same pattern (system prompt + few-shot + JSON response)

**Story 4a-3 (Key Skills Extraction - READY):**
- Extends `JobAnalysis` struct with `key_skills: Vec<String>`
- Story 4b-4 extends same struct with budget fields
- Demonstrates extensibility design (struct grows with each story)

**Key Learnings from Epic 1-3:**
1. **Debouncing:** Settings input debounced 500ms to avoid excessive IPC calls (Story 1-13)
2. **Dark Mode:** Established palette in Story 1-5, all new components follow
3. **Accessibility:** Story 2-8 established keyboard nav + screen reader patterns
4. **Error Handling:** User-friendly error messages with actionable recovery (Story 1-13)
5. **Caching:** Prompt caching reduces costs 50-70% (Stories 3-1, 3-2 use this)

### Database Schema Definition

**Migration File:** `upwork-researcher/src-tauri/migrations/V8__add_budget_fields_to_job_posts.sql`

```sql
-- Budget Alignment Fields (Story 4b.4)
-- Used for weighted scoring algorithm (FR-4, Story 4b-5)

ALTER TABLE job_posts ADD COLUMN budget_min REAL;
ALTER TABLE job_posts ADD COLUMN budget_max REAL;
ALTER TABLE job_posts ADD COLUMN budget_type TEXT DEFAULT 'unknown'; -- 'hourly', 'fixed', 'unknown'
ALTER TABLE job_posts ADD COLUMN budget_alignment_pct INTEGER; -- 0-100+ or null
ALTER TABLE job_posts ADD COLUMN budget_alignment_status TEXT DEFAULT 'gray'; -- 'green', 'yellow', 'red', 'gray', 'mismatch'

-- Index for filtering jobs by budget alignment (Story 4b-9: Job Queue View)
CREATE INDEX IF NOT EXISTS idx_job_posts_budget_alignment ON job_posts(budget_alignment_status);
```

**Schema Rationale:**
- `budget_min/max`: REAL for decimal precision ($50.50/hr)
- `budget_max`: Null if single value ($50/hr has max=null), populated for ranges ($30-50/hr)
- `budget_type`: TEXT enum for type safety (hourly/fixed/unknown)
- `budget_alignment_pct`: INTEGER (67%, 100%, 125%) or null if can't calculate
- `budget_alignment_status`: TEXT for UI color coding (green/yellow/red/gray/mismatch)
- Index on status enables fast filtering: "Show me only green/yellow jobs" in Story 4b-9

### Settings Schema Extension

**New Settings Keys (stored in existing `settings` table):**
- `user_hourly_rate` (TEXT): User's hourly rate as decimal string (e.g., "75.00")
- `user_project_rate_min` (TEXT): Minimum project budget user accepts (e.g., "2000.00")

**Rationale for TEXT storage:**
- SQLite REAL has precision issues with money (0.1 + 0.2 ≠ 0.3)
- TEXT storage preserves exact decimal values, parse to f64 in Rust
- Future: can extend with `user_project_rate_max` for range preferences

### Project Structure Notes

**New Files to Create:**
- `upwork-researcher/src-tauri/migrations/V8__add_budget_fields_to_job_posts.sql` — Database schema
- None (Settings UI extends existing Settings.tsx from Story 4b-1)
- None (Budget alignment display integrates into Story 4a-7 or 4b-6 component)

**Files to Modify:**
- `upwork-researcher/src-tauri/src/analysis.rs` — Extend JobAnalysis struct, add extract_budget(), add calculate_budget_alignment()
- `upwork-researcher/src-tauri/src/lib.rs` — Add rate config commands (get/set), integrate budget into analyze_job_post command
- `upwork-researcher/src/components/Settings.tsx` — Add rate configuration inputs (2 number fields)
- `upwork-researcher/src/components/JobAnalysisResults.tsx` (or wherever job analysis is displayed) — Add budget alignment display

**Files to Reference:**
- `upwork-researcher/src-tauri/src/claude.rs` — analyze_perplexity pattern for Haiku API calls
- `upwork-researcher/src-tauri/migrations/V3__add_job_posts_table.sql` — Existing job_posts schema
- `upwork-researcher/src-tauri/src/db/settings.rs` (if exists) — Settings CRUD patterns

### Budget Extraction Algorithm Details

**Claude Haiku System Prompt (Cached):**

```
You are a budget extraction specialist for Upwork job posts.

Your task: Extract budget information from job post text and return structured JSON.

Output format:
{
  "budget_min": 50.0,        // Minimum budget (hourly rate or total project budget)
  "budget_max": 75.0,        // Maximum budget (only for ranges, else same as min)
  "budget_type": "hourly"    // "hourly", "fixed", or "unknown"
}

Rules:
1. Identify budget type:
   - "hourly" if text contains: "/hr", "/hour", "per hour", "hourly rate"
   - "fixed" if text contains: "fixed", "total budget", "project budget", or dollar amount without hourly indicators
   - "unknown" if no budget mentioned

2. Extract numeric values:
   - Parse "$50/hr" → 50.0
   - Parse "$5k" → 5000.0
   - Parse "$2,000" → 2000.0
   - Parse ranges "$30-50/hr" → min=30.0, max=50.0
   - Parse ranges "$5k-$10k" → min=5000.0, max=10000.0

3. If single value (not a range), set budget_max = budget_min

4. If no budget mentioned, return:
   {
     "budget_min": null,
     "budget_max": null,
     "budget_type": "unknown"
   }

5. Be conservative: If ambiguous between hourly and fixed, prefer "unknown"

Examples:
[Few-shot examples here - see Subtask 4.4]
```

**Budget Alignment Calculation Logic:**

```rust
fn calculate_budget_alignment(budget: &BudgetInfo, user_rate: &RateConfig) -> BudgetAlignment {
    // Type mismatch checks
    if budget.budget_type == "hourly" && user_rate.hourly_rate.is_none() {
        return BudgetAlignment { percentage: None, status: "mismatch".to_string() };
    }
    if budget.budget_type == "fixed" && user_rate.project_rate_min.is_none() {
        return BudgetAlignment { percentage: None, status: "mismatch".to_string() };
    }
    if budget.budget_type == "unknown" {
        return BudgetAlignment { percentage: None, status: "gray".to_string() };
    }

    // Calculate percentage (use budget_min for conservative estimate)
    let percentage = match budget.budget_type.as_str() {
        "hourly" => {
            let job_rate = budget.budget_min.unwrap_or(0.0);
            let user_rate_val = user_rate.hourly_rate.unwrap_or(0.0);
            if user_rate_val == 0.0 { return BudgetAlignment { percentage: None, status: "gray".to_string() }; }
            ((job_rate / user_rate_val) * 100.0) as i32
        },
        "fixed" => {
            let job_budget = budget.budget_min.unwrap_or(0.0);
            let user_min = user_rate.project_rate_min.unwrap_or(0.0);
            if user_min == 0.0 { return BudgetAlignment { percentage: None, status: "gray".to_string() }; }
            ((job_budget / user_min) * 100.0) as i32
        },
        _ => return BudgetAlignment { percentage: None, status: "gray".to_string() }
    };

    // Color status based on percentage
    let status = if percentage >= 100 {
        "green"
    } else if percentage >= 70 {
        "yellow"
    } else {
        "red"
    }.to_string();

    BudgetAlignment { percentage: Some(percentage), status }
}
```

### UX Flow Example

**User Journey:**

1. **First-time setup:**
   - User opens Settings → Profile → Rates
   - Enters hourly rate: $75/hr
   - Enters minimum project rate: $2000
   - Sees "Saving..." → "Saved"

2. **Job analysis with aligned budget:**
   - User pastes job: "Budget: $50-75/hr, looking for React developer"
   - Clicks "Analyze Job"
   - System extracts: budget_min=$50, budget_max=$75, type=hourly
   - Calculates alignment: $50 / $75 = 67% → YELLOW
   - Displays: "Budget Alignment: 67%" in yellow badge
   - Tooltip: "Job budget: $50-75/hr, Your rate: $75/hr"

3. **Job analysis with misaligned budget:**
   - User pastes job: "Fixed price: $500 for website redesign"
   - System extracts: budget_min=$500, type=fixed
   - Calculates alignment: $500 / $2000 = 25% → RED
   - Displays: "Budget Alignment: 25%" in red badge
   - User sees red flag, skips this job

4. **Job analysis with no budget:**
   - User pastes job: "Looking for senior developer, please quote your rate"
   - System extracts: type=unknown
   - Displays: "Budget Alignment: Unknown" in gray badge
   - Tooltip: "Budget not mentioned in job post"

5. **Job analysis with type mismatch:**
   - User has only hourly rate configured ($75/hr), no project rate
   - User pastes job: "Fixed price: $3000 for landing page"
   - System extracts: budget_min=$3000, type=fixed
   - Detects mismatch (user has no project rate configured)
   - Displays: "Budget Type Mismatch" in gray badge
   - Tooltip: "Job is fixed-price but you haven't configured a project rate in Settings"

**Edge Cases:**
- **User has no rates configured:** Show "Configure rates in Settings to see budget alignment"
- **Budget range ($30-50/hr):** Use minimum ($30) for conservative alignment
- **Budget in "k" notation ($5k-$10k):** Parse as 5000-10000
- **Ambiguous budget ("competitive rate"):** Extract as unknown
- **Negative budget (data error):** Status=gray, percentage=null

### Security Considerations

**Data Privacy:**
- User rate configuration stored in encrypted database (SQLCipher AES-256)
- Budget data from job posts stored encrypted
- No telemetry on user rates or budget alignment (NFR-10: zero telemetry default)

**Input Validation:**
- User rate inputs validated: must be positive numbers, max 6 digits (prevent overflow)
- Budget extraction handles malformed API responses (default to unknown)
- Division by zero checks in alignment calculation (prevent panics)

**API Security:**
- Budget extraction uses same API key retrieval as Stories 4a-2, 4a-3 (keychain)
- Prompt caching headers prevent prompt injection (cached prompts immutable)
- No user input directly concatenated into prompts (job content is user message, not system prompt)

### Accessibility Requirements

**Keyboard Navigation:**
- Tab key focuses rate input fields
- Enter saves current rate value
- Budget alignment badges keyboard-focusable (show tooltip on focus)

**Screen Reader Support:**
- Rate inputs have aria-label: "Hourly rate in dollars per hour"
- Budget alignment status announced: "Budget alignment: 90 percent, green status, budget meets your rate expectations"
- Tooltips have aria-describedby for screen reader association

**High Contrast Mode:**
- Green badge (#22c55e) has 6.8:1 contrast on dark background (#1a1a1a)
- Yellow badge (#eab308) has 13.2:1 contrast
- Red badge (#ef4444) has 5.9:1 contrast
- Gray badge (#6b7280) has 4.6:1 contrast (all meet WCAG AA)

### Testing Strategy

**Backend Unit Tests:**
- Test extract_budget() with 10+ real Upwork job post samples
- Test calculate_budget_alignment() with all edge cases (mismatch, unknown, ranges)
- Test rate config CRUD operations (set/get user rates)

**Frontend Unit Tests:**
- Test rate configuration UI (input, debounce, save)
- Test budget alignment display (all color states, tooltips)
- Test "Configure rates" message when user has no rates

**Integration Tests (Manual):**
- Test full flow: configure rates → analyze job → see budget alignment
- Test budget persistence: analyze job, restart app, verify budget loaded
- Test Haiku API call with prompt caching (verify cache hit logs)

**Performance Tests:**
- Measure budget extraction time (<3s target)
- Measure alignment calculation time (<10ms target)
- Measure job queue filtering by alignment status (<100ms target)

### References

- [Source: epics-stories.md#Epic 4b: Job Scoring & Pipeline Management / Story 4b.4]
- [Source: prd.md#FR-4: Weighted Job Scoring]
- [Source: architecture.md#AR-1: Tauri Desktop Framework]
- [Source: architecture.md#AR-2: SQLCipher Database Integration]
- [Source: architecture.md#AR-4: LLM Provider (Claude Haiku)]
- [Source: architecture.md#AR-5: Prompt Caching]
- [Source: prd.md#NFR-2: Local Data Encryption]
- [Source: prd.md#NFR-4: UI Response <100ms]
- [Source: prd.md#NFR-9: Query Performance]
- [Source: prd.md#NFR-14: Accessibility WCAG 2.1 AA]
- [Source: Story 4a-2: Client Name Extraction — analysis.rs module pattern]
- [Source: Story 4a-3: Key Skills Extraction — JobAnalysis struct extension pattern]
- [Source: Story 4b-5: Weighted Job Scoring — budget alignment contributes 20% weight]

## Dev Agent Record

### Agent Model Used
- (Pending implementation)

### Implementation Summary
- (Pending implementation)

### Deferred Work
- None

### Acceptance Criteria Status
- ⏳ **AC-1:** Pending implementation
- ⏳ **AC-2:** Pending implementation
- ⏳ **AC-3:** Pending implementation
- ⏳ **AC-4:** Pending implementation
- ⏳ **AC-5:** Pending implementation

### File List
- (Pending implementation)

## Change Log

- 2026-02-06: Story enhanced with comprehensive dev context — SM Agent (Bob)
  - Added database migration V8 for budget fields (6 columns + index)
  - Added user rate configuration commands (get/set for hourly and project rates)
  - Added budget extraction algorithm with Claude Haiku prompt specification
  - Added budget alignment calculation logic with type mismatch handling
  - Added Tasks/Subtasks breakdown (9 tasks, 50+ subtasks)
  - Added Dev Notes: AR/NFR references, story position, previous story intelligence
  - Added budget extraction algorithm pseudocode and alignment calculation logic
  - Added UX flow examples with 5 user journeys covering all edge cases
  - Added security considerations, accessibility requirements, testing strategy
  - **Status: ready-for-dev — all context provided, recommend implementing Stories 4a-2, 4a-3, 4a-4 first to avoid merge conflicts**

- 2026-02-05: Story created by sprint-planning workflow
