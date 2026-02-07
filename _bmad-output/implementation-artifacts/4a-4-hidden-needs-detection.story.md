---
status: ready-for-dev
---

# Story 4a.4: Hidden Needs Detection

## Story

As a freelancer,
I want the app to identify implied client priorities not explicitly stated,
So that I can address their real concerns in my proposal.

## Acceptance Criteria

**AC-1:** Given job analysis is running (user clicked "Analyze Job"), When Claude Haiku analyzes the job post, Then it identifies 2-3 hidden needs based on language patterns in the post alongside the existing client name and skills extraction (single API call).

**AC-2:** Given hidden needs are detected, Then each is displayed with a label and supporting evidence:
- "Client is stressed -> They mention 'urgent' and 'ASAP'"
- "Budget-conscious -> They emphasize 'cost-effective solution'"

**AC-3:** Given hidden needs are detected, Then they are saved to the `job_posts` table as a JSON TEXT field (`hidden_needs` column, new migration).

**AC-4:** Given the job post has no discernible hidden needs, Then an empty list is returned and the UI shows "No hidden needs detected" in the display area.

**AC-5:** Given fewer than 2 or more than 3 hidden needs are identified, Then the system still returns whatever it finds (2-3 is guidance to the LLM, not hard validation).

**AC-6:** Given the API call fails during extraction, Then the error is surfaced inline (consistent with 4a-2/4a-3 error handling) and any previously extracted client name and skills are still displayed.

## Technical Notes

### Requirements Traceability

- **FR-2:** System extracts "Client Name", "Key Skills", and "Hidden Needs" — defined as 2-3 implied client priorities beyond explicitly stated requirements. This story completes FR-2's extraction scope.
- **AR-4:** Claude Haiku 4.5 for cost-effective analysis
- **AR-5:** Prompt caching already set up in 4a-2, extended in 4a-3 — this story extends the cached system prompt further
- **Round 4 Thesis Defense:** Hidden needs identified as most valuable feature for high-volume users (Marcus persona)

### Architecture: Extends Stories 4a-2 and 4a-3

This story is the final extraction extension to 4a-2's `analysis.rs` module. After this story, the single `analyze_job_post` call extracts all three FR-2 fields.

**1. Extend `JobAnalysis` struct:**

```rust
#[derive(Serialize, Deserialize)]
pub struct HiddenNeed {
    pub need: String,       // "Client is stressed"
    pub evidence: String,   // "They mention 'urgent' and 'ASAP'"
}

pub struct JobAnalysis {
    pub client_name: Option<String>,   // from 4a-2
    pub key_skills: Vec<String>,       // from 4a-3
    pub hidden_needs: Vec<HiddenNeed>, // NEW in 4a-4
}
```

**Note:** Hidden needs are structured (need + evidence), not plain strings. The AC requires displaying explanations alongside each need, which demands a richer type than `Vec<String>`.

**2. Extend the system prompt** to also extract hidden needs. The prompt should now return:

```json
{
  "client_name": "John Smith",
  "key_skills": ["React", "TypeScript", "API Integration"],
  "hidden_needs": [
    {"need": "Client is stressed", "evidence": "They mention 'urgent' and 'ASAP'"},
    {"need": "Budget-conscious", "evidence": "They emphasize 'cost-effective solution'"}
  ]
}
```

**3. Single API call** — All three extraction fields in one Haiku request. No additional API call. This is the most reasoning-intensive extraction (compared to client name and skills), so the prompt engineering here is critical.

**4. Extend the Tauri command** — `analyze_job_post` already returns `JobAnalysis`. After adding `hidden_needs`, the frontend receives all three fields from the same invocation.

### Prompt Design for Hidden Needs

This is the most nuanced extraction — it requires inference, not just surface-level parsing. Add to the existing system prompt:

**Instructions for hidden needs extraction:**

- Identify 2-3 implied client priorities that are NOT explicitly stated but can be inferred from language patterns
- Each hidden need must include: (a) a concise label describing the priority, (b) the specific evidence from the job post
- Common patterns to detect:
  - "urgent", "ASAP", "fast turnaround" -> Client is time-pressured
  - "proven track record", "references required" -> Client is risk-averse
  - "cost-effective", "budget-friendly" -> Client is budget-conscious
  - "ongoing project", "monthly retainer" -> Client wants long-term partnership
  - "experienced only", "senior developer" -> Client has been burned by junior devs
  - "NDA required", "confidential" -> Client has IP/trust concerns
  - "detailed proposal expected" -> Client values thoroughness
- If the job post is too vague or generic to infer hidden needs, return an empty array
- Do NOT fabricate needs — only infer from actual language in the post

**Additional few-shot examples (extend existing set):**
1. Job post with urgency signals -> `[{"need": "Time-pressured", "evidence": "Mentions 'need this done by Friday' and 'quick turnaround'"}]`
2. Job post with trust concerns -> `[{"need": "Risk-averse", "evidence": "Requires 'proven track record' and 'references from similar projects'"}]`
3. Generic job post with no inferrable patterns -> `[]`

### Database: New Migration for hidden_needs Column

The `job_posts` table needs a `hidden_needs` TEXT column to store JSON. This follows the established JSON-in-TEXT pattern from V5 (`generation_params` in proposals table).

**New migration V7 — add hidden_needs column:**

```sql
ALTER TABLE job_posts ADD COLUMN hidden_needs TEXT;
-- JSON string: [{"need": "...", "evidence": "..."}, ...]
```

**Design notes:**

- TEXT column storing JSON (SQLite standard, matches V5 pattern)
- Nullable — `NULL` means analysis hasn't run yet; `'[]'` means no hidden needs detected
- Stored as serialized JSON array of `{need, evidence}` objects
- Story 4a-8 will ensure atomic save of all analysis fields in a single transaction

### Display Format

Hidden needs require a different UI treatment than client name (single text) or skills (tag chips). Each need is a structured insight with supporting evidence.

**Display pattern:**

```
Hidden Needs:
  * Client is stressed
    -> They mention 'urgent' and 'ASAP'
  * Budget-conscious
    -> They emphasize 'cost-effective solution'
```

Use a compact list with the need as bold/primary text and evidence as secondary/muted text below it. Keep it minimal — Story 4a-7 will build the comprehensive analysis results display.

## Tasks / Subtasks

- [ ] Task 1: Create migration for hidden_needs column (AC: 3)
  - [ ] 1.1: Create `src-tauri/migrations/V7__add_hidden_needs_to_job_posts.sql` with `ALTER TABLE job_posts ADD COLUMN hidden_needs TEXT;`
  - [ ] 1.2: Verify migration runs successfully on app startup

- [ ] Task 2: Add `HiddenNeed` struct and extend `JobAnalysis` (AC: 1, 4, 5)
  - [ ] 2.1: Add `HiddenNeed` struct with `need: String` and `evidence: String` fields, derive `Serialize, Deserialize, Clone`
  - [ ] 2.2: Add `hidden_needs: Vec<HiddenNeed>` field to `JobAnalysis` struct in `analysis.rs`
  - [ ] 2.3: Extend system prompt with hidden needs extraction instructions and patterns (see Prompt Design section)
  - [ ] 2.4: Add 2-3 few-shot examples covering urgency, risk-aversion, and empty-result cases
  - [ ] 2.5: Update JSON parsing to extract `hidden_needs` array of objects from response
  - [ ] 2.6: Default to empty `Vec` if `hidden_needs` field is missing or malformed (graceful degradation)

- [ ] Task 3: Add database functions for hidden_needs persistence (AC: 3)
  - [ ] 3.1: Add `update_job_post_hidden_needs(conn, id: i64, hidden_needs_json: &str) -> Result<()>` to `db/queries/job_posts.rs`
  - [ ] 3.2: Serialize `Vec<HiddenNeed>` to JSON string before storing
  - [ ] 3.3: Add `get_job_post_hidden_needs(conn, id: i64) -> Result<Vec<HiddenNeed>>` — deserialize JSON from DB

- [ ] Task 4: Update Tauri command to save hidden needs (AC: 1, 3)
  - [ ] 4.1: In `analyze_job_post` command (lib.rs), after extraction: serialize hidden_needs to JSON and call `update_job_post_hidden_needs`
  - [ ] 4.2: Include in same save flow as client_name update and skills insert (4a-8 will wrap in transaction)
  - [ ] 4.3: `JobAnalysis` return value already includes `hidden_needs` — frontend receives it automatically

- [ ] Task 5: Display hidden needs in frontend (AC: 2, 4)
  - [ ] 5.1: Create `HiddenNeedsDisplay.tsx` component — renders array of `{need, evidence}` objects
  - [ ] 5.2: Each item shows need as bold/primary text, evidence as secondary/muted text with arrow prefix
  - [ ] 5.3: Place below `SkillTags` in App.tsx (within the analysis results area)
  - [ ] 5.4: When hidden_needs array is empty, show "No hidden needs detected" in muted text
  - [ ] 5.5: Style consistently with existing theme (dark/light mode via CSS variables)
  - [ ] 5.6: Update App.tsx state to store `hiddenNeeds: Array<{need: string, evidence: string}>` from `JobAnalysis` response
  - [ ] 5.7: Keep it minimal — Story 4a-7 will build the comprehensive results display

- [ ] Task 6: Write tests (AC: All)
  - [ ] 6.1: Rust unit test: migration adds `hidden_needs` column to `job_posts`
  - [ ] 6.2: Rust unit test: `HiddenNeed` struct serializes/deserializes correctly
  - [ ] 6.3: Rust unit test: `update_job_post_hidden_needs` stores JSON string in DB
  - [ ] 6.4: Rust unit test: `get_job_post_hidden_needs` returns deserialized `Vec<HiddenNeed>`
  - [ ] 6.5: Rust unit test: extended `JobAnalysis` JSON parsing includes `hidden_needs` array of objects
  - [ ] 6.6: Rust unit test: missing `hidden_needs` in API response defaults to empty vec
  - [ ] 6.7: Rust unit test: malformed `hidden_needs` (wrong shape) defaults to empty vec
  - [ ] 6.8: Frontend test: `HiddenNeedsDisplay` renders need + evidence for 2 items
  - [ ] 6.9: Frontend test: `HiddenNeedsDisplay` shows "No hidden needs detected" for empty array
  - [ ] 6.10: Frontend test: `HiddenNeedsDisplay` not rendered before analysis runs

## Dev Notes

### Dependencies

- **Story 4a-2 (HARD DEPENDENCY):** Creates `analysis.rs`, `JobAnalysis` struct, and `analyze_job_post` Tauri command
- **Story 4a-3 (HARD DEPENDENCY):** Extends `JobAnalysis` to include `key_skills`. The prompt grows incrementally — 4a-4 should build on 4a-3's prompt, not 4a-2's
- **Migration V6 (from 4a-3) must exist:** This story adds V7. Migration ordering matters.

### Existing Code References

| File | What's There (after 4a-3) | What to Change |
|:-----|:--------------------------|:---------------|
| `src-tauri/src/analysis.rs` | `JobAnalysis { client_name, key_skills }`, extraction function | Add `HiddenNeed` struct, `hidden_needs: Vec<HiddenNeed>`, extend prompt |
| `src-tauri/src/lib.rs` | `analyze_job_post` Tauri command with skills save | Add hidden_needs save after extraction |
| `src-tauri/src/db/queries/job_posts.rs` | `insert_job_post`, `update_job_post_client_name`, skills CRUD | Add hidden_needs update/get functions |
| `src/App.tsx` | `AnalyzeButton`, `ClientNameDisplay`, `SkillTags`, analysis state | Add `hiddenNeeds` state, render `HiddenNeedsDisplay` |
| `src-tauri/migrations/` | V1-V6 | Add V7 for hidden_needs column |
| `src-tauri/migrations/V5__add_humanization_settings.sql` | JSON-in-TEXT column pattern (reference) | No change — follow same pattern |

### Edge Cases

- **No hidden needs in post:** Generic posts like "need a developer" have no inferrable priorities -> return `[]`
- **Fabricated needs:** Prompt must instruct NOT to fabricate — only infer from actual language. This is the biggest risk with this extraction type
- **Overlapping needs:** LLM might return "urgent" and "time-pressured" as separate needs -> prompt should instruct deduplication of similar concepts
- **Very long evidence strings:** LLM might quote large passages -> prompt should instruct concise evidence (1 sentence max)
- **Re-analysis:** User clicks "Analyze" again -> overwrite hidden_needs JSON (same row, same column)
- **Non-English posts:** Haiku handles multilingual -> hidden needs detection works across languages

### Scope Boundaries

**In scope:**

- `HiddenNeed` struct with need + evidence fields
- Extend `JobAnalysis` struct and prompt for hidden needs extraction
- V7 migration adding `hidden_needs TEXT` column
- Hidden needs persistence functions (serialize to JSON, store in TEXT column)
- `HiddenNeedsDisplay` component with need/evidence formatting
- Wire into existing "Analyze Job" flow

**Out of scope:**

- Comprehensive results display (Story 4a-7)
- Atomic save transaction (Story 4a-8)
- Input sanitization (Story 4a-9)
- Using hidden needs in proposal generation (Epic 5)
- Scoring based on hidden needs (not in current scope)

### NFR Targets

| NFR | Target | Validation |
|:----|:-------|:-----------|
| Analysis speed | <3 seconds (combined extraction, all 3 fields) | Hidden needs adds reasoning complexity — monitor if Haiku stays under 3s with full prompt |
| DB update | <100ms for hidden_needs JSON write | Simple UPDATE on single column |

### Prompt Size Consideration

After 4a-4, the system prompt includes extraction instructions for client name + skills + hidden needs + all few-shot examples. Monitor total prompt size:

- If prompt exceeds cache limits, consider splitting few-shot examples into a separate cached block
- Prompt caching (AR-5) should keep repeat-call costs low despite growing prompt

### References

- [FR-2: prd.md Section 4.2 — Hidden Needs defined as "2-3 implied client priorities beyond explicitly stated requirements"]
- [Story 4a-2: analysis.rs module and JobAnalysis struct]
- [Story 4a-3: key_skills extension pattern]
- [V5 migration: JSON-in-TEXT column precedent (generation_params)]
- [Round 4 Thesis Defense: Hidden needs most valuable for Marcus persona]
