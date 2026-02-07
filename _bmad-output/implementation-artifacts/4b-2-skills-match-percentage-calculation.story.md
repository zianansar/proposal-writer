---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0/6
testsWritten: 0
dependencies:
  - 4b-1-user-profile-skills-configuration  # Provides user_skills table
  - 4a-3-key-skills-extraction              # Provides job_skills table
---

# Story 4b.2: Skills Match Percentage Calculation

## Story

As a freelancer,
I want to see how well my skills match the job requirements,
So that I know if this job is a good fit for me.

## Acceptance Criteria

**AC-1:** Given I have configured my skills profile (Story 4b.1) and a job has been analyzed (Story 4a.3)
**When** I view the job analysis results
**Then** the system calculates skills match percentage using: `(user_skills ∩ job_skills) / count(job_skills) * 100`
**And** the result is stored in a new `job_scores` table linked to the job_post_id
**And** the calculation is case-insensitive (e.g., "javascript" matches "JavaScript")

**AC-2:** Given the skills match percentage is calculated
**When** I view the job analysis display
**Then** I see "Skills Match: 67%" with color coding:
- Green (≥75%): #10b981 (success green)
- Yellow (50-74%): #f59e0b (warning amber)
- Red (<50%): #ef4444 (danger red)

**AC-3:** Given edge cases exist
**When** the calculation runs
**Then** it handles:
- No user skills configured → return null (display "Configure skills in Settings")
- No job skills extracted → return null (display "No skills detected in job post")
- Empty intersection → return 0% (red)
- Partial fuzzy matches (e.g., "React.js" vs "React") → exact match only (no fuzzy logic in MVP)

## Tasks / Subtasks

### Database Implementation (Rust + Migration)

- [ ] Task 1: Create job_scores table migration (AC: #1)
  - [ ] Subtask 1.1: Create migration `V8__add_job_scores_table.sql`
  - [ ] Subtask 1.2: Define schema: `id INTEGER PRIMARY KEY, job_post_id INTEGER UNIQUE NOT NULL, skills_match_percentage REAL, client_quality_score INTEGER, budget_alignment_score INTEGER, overall_score REAL, calculated_at TEXT DEFAULT CURRENT_TIMESTAMP`
  - [ ] Subtask 1.3: Add foreign key: `FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE`
  - [ ] Subtask 1.4: Add unique constraint on job_post_id (one score per job)
  - [ ] Subtask 1.5: Add index: `CREATE INDEX idx_job_scores_job_post_id ON job_scores(job_post_id);`
  - [ ] Subtask 1.6: Add index for filtering by score: `CREATE INDEX idx_job_scores_overall ON job_scores(overall_score DESC);`
  - [ ] Subtask 1.7: Verify migration runs successfully

### Backend Implementation (Rust)

- [ ] Task 2: Implement skills match calculation function (AC: #1, #3)
  - [ ] Subtask 2.1: Create `calculate_skills_match(job_post_id: i64, conn: &Connection) -> Result<Option<f64>, String>` function in lib.rs or new `scoring.rs` module
  - [ ] Subtask 2.2: Query user skills: `SELECT skill FROM user_skills ORDER BY skill ASC`
  - [ ] Subtask 2.3: Query job skills: `SELECT skill_name FROM job_skills WHERE job_post_id = ? ORDER BY skill_name ASC`
  - [ ] Subtask 2.4: Handle edge case: if user_skills is empty, return Ok(None) with error message
  - [ ] Subtask 2.5: Handle edge case: if job_skills is empty, return Ok(None) with error message
  - [ ] Subtask 2.6: Normalize both sets to lowercase for comparison: `user_set = user_skills.iter().map(|s| s.to_lowercase()).collect()`
  - [ ] Subtask 2.7: Calculate intersection: `let intersection: HashSet<_> = user_set.intersection(&job_set).collect();`
  - [ ] Subtask 2.8: Calculate percentage: `(intersection.len() as f64 / job_skills.len() as f64) * 100.0`
  - [ ] Subtask 2.9: Round to 1 decimal place: `(percentage * 10.0).round() / 10.0`
  - [ ] Subtask 2.10: Return Ok(Some(percentage))

- [ ] Task 3: Create Tauri command to calculate and store score (AC: #1)
  - [ ] Subtask 3.1: Create `calculate_and_store_skills_match(job_post_id: i64) -> Result<Option<f64>, String>` Tauri command
  - [ ] Subtask 3.2: Call `calculate_skills_match(job_post_id, conn)` to get percentage
  - [ ] Subtask 3.3: If percentage is Some(value), INSERT or UPDATE job_scores table: `INSERT INTO job_scores (job_post_id, skills_match_percentage) VALUES (?, ?) ON CONFLICT(job_post_id) DO UPDATE SET skills_match_percentage = excluded.skills_match_percentage, calculated_at = CURRENT_TIMESTAMP`
  - [ ] Subtask 3.4: Return the calculated percentage to frontend
  - [ ] Subtask 3.5: Register command in invoke_handler

- [ ] Task 4: Create query command to retrieve stored score (AC: #1)
  - [ ] Subtask 4.1: Create `get_job_score(job_post_id: i64) -> Result<Option<JobScore>, String>` Tauri command
  - [ ] Subtask 4.2: Define JobScore struct: `{ job_post_id: i64, skills_match_percentage: Option<f64>, client_quality_score: Option<i32>, budget_alignment_score: Option<i32>, overall_score: Option<f64>, calculated_at: String }`
  - [ ] Subtask 4.3: Query: `SELECT * FROM job_scores WHERE job_post_id = ?`
  - [ ] Subtask 4.4: Return Ok(None) if no score exists yet
  - [ ] Subtask 4.5: Return Ok(Some(JobScore {...})) if found
  - [ ] Subtask 4.6: Register command in invoke_handler

### Frontend Implementation (React)

- [ ] Task 5: Display skills match percentage in job analysis UI (AC: #2)
  - [ ] Subtask 5.1: Identify where to display skills match (likely in JobAnalysisDisplay component from Story 4a.7)
  - [ ] Subtask 5.2: Call `calculate_and_store_skills_match(job_post_id)` after job analysis completes
  - [ ] Subtask 5.3: Handle null result (no user skills or no job skills) → display appropriate message
  - [ ] Subtask 5.4: Handle Some(percentage) → display "Skills Match: 67.0%"
  - [ ] Subtask 5.5: Apply color coding based on percentage:
    - ≥75% → #10b981 (green)
    - 50-74% → #f59e0b (yellow)
    - <50% → #ef4444 (red)
  - [ ] Subtask 5.6: Style with dark mode (background #1a1a1a, text with appropriate color)
  - [ ] Subtask 5.7: Add tooltip on hover: "X of Y required skills matched" (e.g., "2 of 3 required skills matched")
  - [ ] Subtask 5.8: Add aria-label for accessibility: "Skills match percentage: 67%, moderate fit"

### Testing

- [ ] Task 6: Write backend and frontend tests
  - [ ] Subtask 6.1: Test calculate_skills_match with perfect match (100%) → user has all job skills
  - [ ] Subtask 6.2: Test calculate_skills_match with partial match (67%) → user has 2 of 3 job skills
  - [ ] Subtask 6.3: Test calculate_skills_match with no match (0%) → user has none of the job skills
  - [ ] Subtask 6.4: Test case-insensitive matching → "react" matches "React"
  - [ ] Subtask 6.5: Test edge case: no user skills configured → returns None
  - [ ] Subtask 6.6: Test edge case: no job skills extracted → returns None
  - [ ] Subtask 6.7: Test edge case: empty intersection → returns Some(0.0)
  - [ ] Subtask 6.8: Test calculate_and_store_skills_match inserts score into database
  - [ ] Subtask 6.9: Test calculate_and_store_skills_match updates existing score (ON CONFLICT)
  - [ ] Subtask 6.10: Test get_job_score retrieves stored score correctly
  - [ ] Subtask 6.11: Test frontend displays green color for ≥75%
  - [ ] Subtask 6.12: Test frontend displays yellow color for 50-74%
  - [ ] Subtask 6.13: Test frontend displays red color for <50%
  - [ ] Subtask 6.14: Test frontend displays "Configure skills" message when no user skills
  - [ ] Subtask 6.15: Test frontend displays "No skills detected" message when no job skills

## Dev Notes

### Architecture Requirements

**AR-1: Tauri Desktop Framework**
- Backend calculation in Rust for performance (set intersection is O(n))
- Frontend display in React with color-coded UI

**AR-2: SQLCipher Database Integration**
- job_scores table encrypted with AES-256
- Skills match percentage stored as REAL (floating-point, 0.0-100.0)

**AR-3: Database Design Principles**
- job_scores table normalized with foreign key to job_posts
- UNIQUE constraint on job_post_id (one score per job)
- Indexes for fast lookups by job_post_id and sorting by overall_score

### Non-Functional Requirements

**NFR-4: UI Response Time**
- Skills match calculation must complete in <100ms
- Set intersection is O(n) where n = max(user_skills, job_skills)
- Typical case: 5-10 user skills, 3-7 job skills → <10ms calculation time

**NFR-9: Query Performance**
- User skills query: <50ms (indexed, typically 5-50 rows)
- Job skills query: <50ms (indexed by job_post_id, typically 3-7 rows)
- Score storage: <50ms (single INSERT or UPDATE)
- Total latency: <150ms worst case

**NFR-14: Accessibility (WCAG 2.1 AA)**
- Color must not be the only indicator (include text percentage)
- Sufficient contrast for all three color states on dark background
- aria-label announces both percentage and qualitative fit ("moderate fit")

### UX Requirements

**UX-1: Dark Mode by Default**
- **Green:** #10b981 (Tailwind green-500) — high contrast 7.2:1 on #1a1a1a
- **Yellow:** #f59e0b (Tailwind amber-500) — high contrast 8.1:1 on #1a1a1a
- **Red:** #ef4444 (Tailwind red-500) — high contrast 5.8:1 on #1a1a1a

**UX-5: Status Indicators**
- Skills match percentage displayed prominently near job title
- Color-coded badge or tag (not just text color)
- Tooltip provides breakdown (e.g., "2 of 3 required skills matched: React, TypeScript")

### Functional Requirements

**FR-4: Weighted Job Scoring**
- This story provides the **skills match component** of the weighted scoring algorithm
- Story 4b.5 will combine: skills_match_percentage + client_quality_score + budget_alignment_score → overall_score
- Skills match is the **most important factor** in weighted scoring (highest weight)

### Story Position in Epic 4b Flow

**Story 4b.2 Position in Job Scoring Sequence:**
1. **Story 4b.1 (DONE/ENHANCED):** User configures skills profile → user_skills table populated
2. **→ Story 4b.2 (THIS STORY):** Calculate skills match percentage → job_scores.skills_match_percentage
3. **Story 4b.3 (NEXT):** Client quality score → job_scores.client_quality_score
4. **Story 4b.4:** Budget alignment → job_scores.budget_alignment_score
5. **Story 4b.5:** Weighted scoring algorithm → job_scores.overall_score (combines 4b.2, 4b.3, 4b.4)
6. **Story 4b.6:** Scoring breakdown UI → displays all scores from job_scores table

**Critical Dependencies:**
- **MUST complete Story 4b.1** before implementing 4b.2 (needs user_skills table)
- **MUST complete Story 4a.3** before implementing 4b.2 (needs job_skills table)
- **SHOULD complete Story 4a.7** for display integration (job analysis results UI)

### Previous Story Intelligence

**Story 4b.1 (User Profile Skills - ENHANCED):**
- user_skills table schema: `id, skill, added_at, is_primary`
- Skills stored with case-insensitive UNIQUE constraint
- Query pattern: `SELECT skill FROM user_skills ORDER BY skill ASC`

**Story 4a.3 (Key Skills Extraction - READY):**
- job_skills table schema: `id, job_post_id, skill_name`
- Foreign key to job_posts with ON DELETE CASCADE
- Index on skill_name for fast lookups
- Query pattern: `SELECT skill_name FROM job_skills WHERE job_post_id = ?`

**Story 4a.7 (Job Analysis Results Display - READY):**
- Component: JobAnalysisDisplay (or similar)
- Displays client name + skills tags
- Integration point: Add skills match percentage below skills tags

**Key Learnings from Epic 1-2:**
1. **Database patterns:** Use ON CONFLICT for upsert operations (Story 1-8)
2. **Error handling:** Return Option<T> for nullable results, clear error messages (Story 1-13)
3. **Performance:** Database queries should be <50ms, UI updates <100ms (Story 2-8)

### Database Schema Definition

**Migration File:** `upwork-researcher/src-tauri/migrations/V8__add_job_scores_table.sql`

```sql
-- Job Scores Table for Weighted Scoring (Story 4b.2, 4b.3, 4b.4, 4b.5)
-- Stores all scoring components for FR-4 weighted job scoring

CREATE TABLE IF NOT EXISTS job_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_post_id INTEGER UNIQUE NOT NULL,

    -- Individual score components (Stories 4b.2, 4b.3, 4b.4)
    skills_match_percentage REAL,           -- 0.0-100.0, Story 4b.2
    client_quality_score INTEGER,           -- 0-100, Story 4b.3
    budget_alignment_score INTEGER,         -- 0-100, Story 4b.4

    -- Combined weighted score (Story 4b.5)
    overall_score REAL,                     -- 0.0-100.0, weighted combination

    -- Metadata
    calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
);

-- Index for fast lookups by job post
CREATE INDEX idx_job_scores_job_post_id ON job_scores(job_post_id);

-- Index for sorting jobs by overall score (Story 4b.9: Job Queue View)
CREATE INDEX idx_job_scores_overall ON job_scores(overall_score DESC);
```

**Schema Rationale:**
- `job_post_id UNIQUE`: One score per job post (prevents duplicates)
- `skills_match_percentage REAL`: Allows fractional percentages (67.5%)
- `client_quality_score INTEGER`: 0-100 scale (Story 4b.3)
- `budget_alignment_score INTEGER`: 0-100 scale (Story 4b.4)
- `overall_score REAL`: Weighted combination (Story 4b.5)
- `calculated_at`: Track when score was last updated (useful for cache invalidation)
- `ON DELETE CASCADE`: Auto-delete score when job post is deleted
- Indexes optimize both single-job lookups and sorted job queue display

### Algorithm Implementation

**Skills Match Calculation:**

```rust
pub fn calculate_skills_match(
    job_post_id: i64,
    conn: &Connection,
) -> Result<Option<f64>, String> {
    // 1. Query user skills
    let mut stmt = conn.prepare("SELECT skill FROM user_skills ORDER BY skill ASC")
        .map_err(|e| format!("Failed to prepare user skills query: {}", e))?;

    let user_skills: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| format!("Failed to query user skills: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect user skills: {}", e))?;

    // Edge case: no user skills configured
    if user_skills.is_empty() {
        return Ok(None);
    }

    // 2. Query job skills
    let mut stmt = conn.prepare("SELECT skill_name FROM job_skills WHERE job_post_id = ? ORDER BY skill_name ASC")
        .map_err(|e| format!("Failed to prepare job skills query: {}", e))?;

    let job_skills: Vec<String> = stmt
        .query_map([job_post_id], |row| row.get(0))
        .map_err(|e| format!("Failed to query job skills: {}", e))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("Failed to collect job skills: {}", e))?;

    // Edge case: no job skills extracted
    if job_skills.is_empty() {
        return Ok(None);
    }

    // 3. Normalize to lowercase for case-insensitive comparison
    let user_set: HashSet<String> = user_skills
        .iter()
        .map(|s| s.to_lowercase())
        .collect();

    let job_set: HashSet<String> = job_skills
        .iter()
        .map(|s| s.to_lowercase())
        .collect();

    // 4. Calculate intersection
    let intersection: HashSet<_> = user_set.intersection(&job_set).collect();

    // 5. Calculate percentage
    let percentage = (intersection.len() as f64 / job_skills.len() as f64) * 100.0;

    // 6. Round to 1 decimal place
    let rounded = (percentage * 10.0).round() / 10.0;

    Ok(Some(rounded))
}
```

**Edge Cases Handling:**
1. **No user skills** → Return `Ok(None)` → Frontend displays "Configure skills in Settings"
2. **No job skills** → Return `Ok(None)` → Frontend displays "No skills detected in job post"
3. **Empty intersection** → Return `Ok(Some(0.0))` → Frontend displays "0% match" in red
4. **Perfect match** → Return `Ok(Some(100.0))` → Frontend displays "100% match" in green
5. **Case mismatch** → Normalized to lowercase before comparison → "React" matches "react"

### Project Structure Notes

**New Files to Create:**
- `upwork-researcher/src-tauri/migrations/V8__add_job_scores_table.sql` — Job scores table
- `upwork-researcher/src-tauri/src/scoring.rs` (optional) — Skills match calculation logic (or add to lib.rs)

**Files to Modify:**
- `upwork-researcher/src-tauri/src/lib.rs` — Add Tauri commands: calculate_and_store_skills_match, get_job_score
- `upwork-researcher/src/components/JobAnalysisDisplay.tsx` (or equivalent from Story 4a.7) — Add skills match display

**Files to Reference:**
- `upwork-researcher/src-tauri/migrations/V7__add_user_skills_table.sql` — User skills schema (Story 4b.1)
- `upwork-researcher/src-tauri/migrations/V6__add_job_skills_table.sql` — Job skills schema (Story 4a.3, absorbed 4a.5)
- `upwork-researcher/src-tauri/src/db/mod.rs` — Database connection patterns

### Color Coding Rationale

**Why Green/Yellow/Red Thresholds:**
- **Green (≥75%):** Strong match — user has most required skills, high confidence proposal
- **Yellow (50-74%):** Moderate match — user has some skills, proposal viable but competitive
- **Red (<50%):** Weak match — user lacks majority of skills, low win probability

**Why These Specific Colors:**
- #10b981 (green-500): Associated with success, positive outcomes
- #f59e0b (amber-500): Associated with caution, "proceed with awareness"
- #ef4444 (red-500): Associated with danger, "high risk"
- All three meet WCAG AA contrast requirements on #1a1a1a dark background

### UX Flow Example

**User Journey:**
1. **User analyzes job** → Stories 4a.1-4a.4 extract client name, skills, hidden needs
2. **Job analysis completes** → Frontend calls `calculate_and_store_skills_match(job_post_id)`
3. **Backend calculates match** → Queries user_skills + job_skills, calculates intersection
4. **Backend stores score** → INSERT INTO job_scores (job_post_id, skills_match_percentage)
5. **Frontend receives percentage** → 67.0% returned to UI
6. **Frontend displays result** → "Skills Match: 67.0%" in yellow (#f59e0b)
7. **User hovers percentage** → Tooltip: "2 of 3 required skills matched: React, TypeScript"
8. **User sees clear signal** → Yellow indicates "moderate fit, proposal viable but competitive"

**Edge Case: No User Skills:**
1. **User analyzes job** → Job skills extracted successfully
2. **Frontend calls calculate_and_store_skills_match** → Backend queries user_skills, finds empty
3. **Backend returns None** → Frontend receives null result
4. **Frontend displays message** → "Configure your skills in Settings to see match percentage"
5. **User clicks "Settings"** → Navigates to Story 4b.1 skills configuration
6. **User adds skills** → Returns to job analysis, sees match percentage appear

### Security Considerations

**Data Privacy:**
- Skills match calculation happens entirely locally (no external API calls)
- No sensitive data transmitted outside encrypted database
- Skills stored in encrypted job_scores and user_skills tables (SQLCipher AES-256)

**Performance Security:**
- Set intersection is O(n) where n = max(user_skills, job_skills)
- Worst case: 50 user skills, 20 job skills → ~70 comparisons → <1ms
- No risk of denial-of-service from excessive skill counts

**Input Validation:**
- job_post_id validated via foreign key constraint
- SQL injection prevented by parameterized queries
- No user input in calculation (operates on stored database values)

### Accessibility Requirements

**Keyboard Navigation:**
- Skills match percentage should be readable by screen readers
- Tooltip accessible via focus (not just hover)

**Screen Reader Support:**
- aria-label: "Skills match percentage: 67%, moderate fit"
- Tooltip content announced on focus
- Color coding supplemented with text ("67%" always visible)

**High Contrast Mode:**
- All three colors (green, yellow, red) meet WCAG AA 4.5:1 minimum contrast
- Percentage text always displayed (not relying solely on color)

### Testing Strategy

**Backend Unit Tests:**
- Test all calculation scenarios (100%, 67%, 0%, null)
- Test case-insensitive matching
- Test edge cases (no user skills, no job skills)
- Test database storage (INSERT, UPDATE on conflict)

**Frontend Unit Tests:**
- Test color application based on percentage ranges
- Test null handling (display appropriate messages)
- Test tooltip content generation

**Integration Tests:**
- Test end-to-end flow: job analysis → skill extraction → match calculation → display
- Test score persistence across app restarts
- Test score recalculation when user updates skills

### Future Enhancements (Post-MVP)

**Fuzzy Matching (Epic 7+):**
- "React.js" matches "React" (strip common suffixes)
- "Node" matches "Node.js" (common abbreviations)
- "k8s" matches "Kubernetes" (common aliases)
- Requires skill normalization dictionary or LLM-based matching

**Weighted Skills (Epic 7+):**
- Mark top 3-5 skills as "primary" in user_skills (is_primary column exists)
- Give higher weight to matches on primary skills
- Formula: `(primary_matches * 2 + other_matches) / (job_skills.len() + primary_matches) * 100`

**Skill Gap Analysis (Epic 7+):**
- Display missing skills: "You're missing: Docker, GraphQL"
- Suggest learning resources for missing skills
- Track skill additions over time (skill acquisition timeline)

### References

- [Source: epics-stories.md#Epic 4b: Job Scoring & Pipeline Management / Story 4b.2]
- [Source: prd.md#FR-4: Weighted Job Scoring]
- [Source: architecture.md#AR-1: Tauri Desktop Framework]
- [Source: architecture.md#AR-2: SQLCipher Database Integration]
- [Source: prd.md#NFR-4: UI Response <100ms]
- [Source: prd.md#NFR-9: Query Performance]
- [Source: prd.md#NFR-14: Accessibility WCAG 2.1 AA]
- [Source: ux-design-specification.md#UX-1: Dark Mode]
- [Source: ux-design-specification.md#UX-5: Status Indicators]
- [Source: Story 4b.1: User Profile Skills Configuration]
- [Source: Story 4a.3: Key Skills Extraction]
- [Source: Story 4a.7: Job Analysis Results Display]

## Dev Agent Record

### Agent Model Used
- (Pending implementation)

### Implementation Summary
- (Pending implementation)

### Deferred Work
- Fuzzy skill matching (requires normalization dictionary)
- Weighted skills (primary vs secondary)
- Skill gap analysis UI

### Acceptance Criteria Status
- ⏳ **AC-1:** Pending implementation
- ⏳ **AC-2:** Pending implementation
- ⏳ **AC-3:** Pending implementation

### File List
- (Pending implementation)

## Change Log

- 2026-02-06: Story enhanced with comprehensive dev context — SM Agent (Bob)
  - Added job_scores table schema definition (V8 migration)
  - Added complete skills match algorithm with Rust implementation
  - Added Tasks/Subtasks breakdown (6 tasks, 40+ subtasks)
  - Added edge case handling (no user skills, no job skills, empty intersection)
  - Added color coding specification (green/yellow/red thresholds)
  - Added Dev Notes: AR/NFR/UX references, algorithm details, testing strategy
  - Added future enhancements section (fuzzy matching, weighted skills, skill gap)
  - **Status: ready-for-dev — all context provided, depends on 4b.1 + 4a.3**

- 2026-02-05: Story created by sprint-planning workflow
