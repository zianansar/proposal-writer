---
status: ready-for-dev
---

# Story 4a.3: Key Skills Extraction

## Story

As a freelancer,
I want to see which skills are required for this job,
So that I can highlight relevant experience in my proposal.

## Acceptance Criteria

**AC-1:** Given job analysis is running (user clicked "Analyze Job"), When Claude Haiku processes the job post, Then it extracts 3-7 key skills mentioned in the post alongside the existing client name extraction (single API call).

**AC-2:** Given skills are extracted, Then they are displayed as styled tags below the client name display: e.g. `[React] [TypeScript] [API Integration] [Testing]`.

**AC-3:** Given skills are extracted, Then each skill is saved to a `job_skills` table linked to the `job_post_id` via foreign key.

**AC-4:** Given the job post mentions fewer than 3 or more than 7 skills, Then the system still returns whatever skills are found (no hard minimum/maximum enforcement — the 3-7 range is guidance to the LLM, not a validation rule).

**AC-5:** Given the job post contains no identifiable skills, Then an empty skills list is returned and the UI shows "No skills detected" in place of tags.

**AC-6:** Given the API call fails during extraction, Then the error is surfaced inline (consistent with 4a-2 error handling) and any previously extracted client name is still displayed.

## Technical Notes

### Requirements Traceability

- **FR-2:** System extracts "Client Name", "Key Skills", and "Hidden Needs" — this story covers Key Skills
- **AR-4:** Claude Haiku 4.5 for cost-effective analysis
- **AR-5:** Prompt caching already set up in 4a-2 — this story extends the cached system prompt

### Architecture: Extends Story 4a-2

This story builds on 4a-2's `analysis.rs` module by extending the existing extraction to include skills. Key integration points:

**1. Extend `JobAnalysis` struct:**

```rust
pub struct JobAnalysis {
    pub client_name: Option<String>,
    pub key_skills: Vec<String>,       // NEW in 4a-3
    // 4a-4 will add: pub hidden_needs: Vec<HiddenNeed>,  // HiddenNeed = { need, evidence }
}
```

**2. Extend the system prompt** in `analysis.rs` to also extract skills. The prompt should now return:

```json
{
  "client_name": "John Smith",
  "key_skills": ["React", "TypeScript", "API Integration", "Testing"]
}
```

**3. Single API call** — Do NOT make a separate Haiku call for skills. Extend the existing `analyze_job_post` prompt and parse both fields from one response. This keeps latency under the <3s target and reduces cost.

**4. Extend the Tauri command** — `analyze_job_post` already returns `JobAnalysis`. After adding `key_skills`, the frontend receives both client name and skills from the same invocation.

### Prompt Design for Skills Extraction

Add to the existing system prompt (few-shot examples already cached per AR-5):

- Extract 3-7 key technical and professional skills from the job post
- Include both explicit skills ("Must know React") and implied skills (e.g., "build REST endpoints" → "API Development")
- Normalize skill names to common industry terms (e.g., "JS" → "JavaScript", "k8s" → "Kubernetes")
- Return as a JSON array of strings
- If no skills identifiable, return empty array `[]`

**Additional few-shot examples (extend existing set from 4a-2):**
1. Technical job post → extracts specific technologies: `["React", "Node.js", "PostgreSQL", "Docker"]`
2. Non-technical job post → extracts professional skills: `["Content Writing", "SEO", "Research"]`
3. Vague post with no clear skills → returns `[]`

### Database: Absorbs Story 4a-5 Scope

Story 4a-5 (Job Skills Table Schema) defines the same `job_skills` table this story needs. Since the AC explicitly requires the migration, this story absorbs 4a-5's scope. **Recommend marking 4a-5 as "absorbed-by: 4a-3" in sprint-status.yaml.**

**New migration V6 — `job_skills` table:**

```sql
CREATE TABLE IF NOT EXISTS job_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_post_id INTEGER NOT NULL,
    skill_name TEXT NOT NULL,
    FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_skills_job_post_id ON job_skills(job_post_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill_name ON job_skills(skill_name);
```

**Schema notes:**
- One-to-many: each job post has 0-N skills
- `ON DELETE CASCADE` ensures skills are cleaned up when job post is deleted
- Index on `skill_name` supports future Epic 4b skills matching queries
- Index on `job_post_id` supports the `JOIN` pattern in Epic 5 (`SELECT * FROM job_posts JOIN job_skills WHERE job_id = ?`)

### Future Consumers of `job_skills`

- **Story 4b-1:** User profile skills configuration (`user_skills` table)
- **Story 4b-2:** Skills match percentage — `COUNT(intersection) / COUNT(job_skills)` per job
- **Story 4b-5:** Weighted job scoring — skills match is 40% of overall score
- **Story 5-8:** Voice-informed generation — joins `job_posts` with `job_skills` for prompt context

## Tasks / Subtasks

- [ ] Task 1: Create `job_skills` migration (AC: 3) — absorbs Story 4a-5
  - [ ] 1.1: Create `src-tauri/migrations/V6__add_job_skills_table.sql` with schema above
  - [ ] 1.2: Verify migration runs successfully on app startup (existing migration framework handles this)
  - [ ] 1.3: Verify foreign key constraint works (insert with invalid job_post_id should fail)

- [ ] Task 2: Add database query functions for job skills (AC: 3)
  - [ ] 2.1: Add `insert_job_skills(conn, job_post_id: i64, skills: &[String]) -> Result<()>` to `db/queries/job_posts.rs` (or new `job_skills.rs` module)
  - [ ] 2.2: Batch insert: loop over skills vec, insert each row with same `job_post_id`
  - [ ] 2.3: Add `get_job_skills(conn, job_post_id: i64) -> Result<Vec<String>>` for retrieval
  - [ ] 2.4: Add `delete_job_skills(conn, job_post_id: i64) -> Result<()>` for re-analysis (clear old skills before inserting new ones)

- [ ] Task 3: Extend `JobAnalysis` struct and extraction prompt (AC: 1, 4, 5)
  - [ ] 3.1: Add `key_skills: Vec<String>` field to `JobAnalysis` struct in `analysis.rs`
  - [ ] 3.2: Update `#[derive(Serialize, Deserialize)]` to include the new field
  - [ ] 3.3: Extend system prompt to also request skills extraction (see Prompt Design section)
  - [ ] 3.4: Add 2-3 few-shot examples covering technical, non-technical, and empty-skills cases
  - [ ] 3.5: Update JSON parsing to extract `key_skills` array from response
  - [ ] 3.6: Default to empty `Vec` if `key_skills` field is missing or malformed (graceful degradation)

- [ ] Task 4: Update Tauri command to save extracted skills (AC: 1, 3)
  - [ ] 4.1: In `analyze_job_post` command (lib.rs), after extraction: call `delete_job_skills` then `insert_job_skills` for the job post (handles re-analysis case)
  - [ ] 4.2: Wrap skills insert in same transaction as client_name update if possible
  - [ ] 4.3: `JobAnalysis` return value already includes `key_skills` — frontend receives it automatically

- [ ] Task 5: Display skills as tags in frontend (AC: 2, 5)
  - [ ] 5.1: Create `SkillTags.tsx` component — renders array of skill strings as styled tag chips
  - [ ] 5.2: Each tag styled with background color, rounded corners, inline layout (horizontal wrap)
  - [ ] 5.3: Place below `ClientNameDisplay` in App.tsx (within the analysis results area)
  - [ ] 5.4: When skills array is empty, show "No skills detected" in muted text
  - [ ] 5.5: Style consistently with existing theme (dark/light mode via CSS variables from `App.css`)
  - [ ] 5.6: Update App.tsx state to store `keySkills: string[]` from `JobAnalysis` response

- [ ] Task 6: Write tests (AC: All)
  - [ ] 6.1: Rust unit test: migration creates `job_skills` table with correct columns
  - [ ] 6.2: Rust unit test: `insert_job_skills` inserts multiple skills linked to job_post_id
  - [ ] 6.3: Rust unit test: `get_job_skills` retrieves correct skills for a given job_post_id
  - [ ] 6.4: Rust unit test: `delete_job_skills` removes all skills for a job_post_id
  - [ ] 6.5: Rust unit test: foreign key constraint — insert with invalid job_post_id fails
  - [ ] 6.6: Rust unit test: extended `JobAnalysis` JSON parsing includes `key_skills` array
  - [ ] 6.7: Rust unit test: missing `key_skills` in JSON response defaults to empty vec
  - [ ] 6.8: Frontend test: `SkillTags` renders tags for `["React", "TypeScript"]`
  - [ ] 6.9: Frontend test: `SkillTags` shows "No skills detected" for empty array
  - [ ] 6.10: Frontend test: `SkillTags` not rendered before analysis runs (no skills state yet)

## Dev Notes

### Dependencies

- **Story 4a-2 (HARD DEPENDENCY):** Must be complete first. 4a-3 extends `analysis.rs`, `JobAnalysis` struct, and the `analyze_job_post` Tauri command that 4a-2 creates.
- **Story 4a-5 (ABSORBED):** This story absorbs 4a-5's scope (job_skills table creation). Recommend updating sprint-status.yaml to reflect this.
- **Migration V5 must exist:** Current migrations go V1-V5. This story adds V6.

### Existing Code References

| File | What's There (after 4a-2) | What to Change |
|:-----|:--------------------------|:---------------|
| `src-tauri/src/analysis.rs` | `JobAnalysis { client_name }`, extraction function | Add `key_skills: Vec<String>`, extend prompt |
| `src-tauri/src/lib.rs` | `analyze_job_post` Tauri command | Add skills save after extraction |
| `src-tauri/src/db/queries/job_posts.rs` | `insert_job_post`, `update_job_post_client_name` | Add skills CRUD functions |
| `src/App.tsx` | `AnalyzeButton`, `ClientNameDisplay`, analysis state | Add `keySkills` state, render `SkillTags` |
| `src/components/AnalyzeButton.tsx` | Trigger for analysis | No change — same trigger, richer response |
| `src-tauri/migrations/` | V1-V5 | Add V6 for job_skills table |

### Edge Cases

- **No skills mentioned:** Some job posts are vague ("need help with project") — return `[]`, show "No skills detected"
- **Very many skills (>7):** LLM may return more than 7; accept them all, don't truncate. The 3-7 range is prompt guidance, not hard validation
- **Duplicate skills:** LLM may return "React" and "ReactJS" — the prompt should instruct normalization, but don't enforce uniqueness at DB level (same skill name for different job posts is expected)
- **Re-analysis:** User clicks "Analyze" again — delete existing skills for that job_post_id, insert fresh set
- **Mixed-case skills:** Store as-is from LLM (already normalized by prompt instructions); matching in Epic 4b will use case-insensitive comparison

### Scope Boundaries

**In scope:**

- Extend `JobAnalysis` struct and prompt to extract skills
- Create `job_skills` table migration (absorbing 4a-5)
- Skills CRUD database functions
- `SkillTags` display component
- Wire into existing "Analyze Job" flow from 4a-2

**Out of scope:**

- User profile skills (Story 4b-1)
- Skills matching percentage (Story 4b-2)
- Hidden needs extraction (Story 4a-4)
- Comprehensive results display (Story 4a-7)
- Input sanitization (Story 4a-9)

### NFR Targets

| NFR | Target | Validation |
|:----|:-------|:-----------|
| Analysis speed | <3 seconds (combined extraction) | Same API call as 4a-2; adding skills to prompt adds minimal latency |
| DB insert | <100ms for skill batch insert | Measure insert time for 7 skills |

### Sprint Status Recommendation

```yaml
# Recommend these changes to sprint-status.yaml:
4a-5-job-skills-table-schema: absorbed-by-4a-3  # Migration included in 4a-3
```

### References

- [FR-2: prd.md Section 4.2 — Key Skills extraction]
- [Story 4a-2: analysis.rs extensibility design]
- [Story 4a-5: job_skills table schema (absorbed)]
- [Story 4b-2: skills match calculation (future consumer)]
- [Story 5-8: voice-informed generation joins job_skills (future consumer)]
