---
status: done
assignedTo: "Dev Agent (Amelia)"
tasksCompleted: 4
totalTasks: 4
testsWritten: true
codeReviewCompleted: true
fileList:
  - upwork-researcher/src-tauri/migrations/V19__add_hook_strategies_table.sql
  - upwork-researcher/src-tauri/src/db/queries/hook_strategies.rs
  - upwork-researcher/src-tauri/src/db/queries/mod.rs
  - upwork-researcher/src-tauri/src/db/mod.rs
  - upwork-researcher/src-tauri/src/analysis.rs (code review fix)
  - upwork-researcher/src-tauri/src/commands/job_queue.rs (code review fix)
---

# Story 5.1: Hook Strategies Seed Data

## Story

As a developer,
I want default hook strategies bundled with the app,
So that users have options immediately without configuration.

## Acceptance Criteria

**AC-1:** Given the database is initialized, When migrations run, Then a `hook_strategies` table is created with columns:
- id (INTEGER PRIMARY KEY)
- name (TEXT NOT NULL UNIQUE)
- description (TEXT NOT NULL)
- examples_json (TEXT NOT NULL) — JSON array of 2-3 example openers
- best_for (TEXT NOT NULL) — describes ideal client/job type
- created_at (TEXT NOT NULL DEFAULT datetime('now'))

**AC-2:** And the table is seeded with 5 default hook strategies:
- Social Proof (examples: "I've helped 12 clients...", "My clients see 40% increase...")
- Contrarian ("Most freelancers will..., but I...")
- Immediate Value ("Here's a quick win you can implement today...")
- Problem-Aware ("I noticed your team is struggling with...")
- Question-Based ("What if you could reduce costs by 30%?")

**AC-3:** And each strategy includes 2-3 example openers stored as JSON array

**AC-4:** And the migration is idempotent (can run multiple times safely)

## Tasks/Subtasks

- [x] Task 1: Create migration for hook_strategies table (AC-1, AC-4)
  - [x] Subtask 1.1: Create V19__add_hook_strategies_table.sql in migrations/ directory
  - [x] Subtask 1.2: Define hook_strategies table schema with all required columns
  - [x] Subtask 1.3: Use CREATE TABLE IF NOT EXISTS for idempotency

- [x] Task 2: Seed default hook strategies (AC-2, AC-3)
  - [x] Subtask 2.1: Insert Social Proof strategy with 3 examples from hook library
  - [x] Subtask 2.2: Insert Contrarian strategy with 2-3 examples
  - [x] Subtask 2.3: Insert Immediate Value strategy with 2-3 examples from hook library
  - [x] Subtask 2.4: Insert Problem-Aware strategy with 2-3 examples from hook library
  - [x] Subtask 2.5: Insert Question-Based strategy with 2-3 examples from hook library
  - [x] Subtask 2.6: Use INSERT OR IGNORE for idempotency (AC-4)

- [x] Task 3: Add Rust query module for hook_strategies (AC-1)
  - [x] Subtask 3.1: Create db/queries/hook_strategies.rs module
  - [x] Subtask 3.2: Implement get_all_hook_strategies() function
  - [x] Subtask 3.3: Implement get_hook_strategy_by_id() function
  - [x] Subtask 3.4: Add HookStrategy struct with serde derives

- [x] Task 4: Add tests for hook_strategies (AC-1, AC-2, AC-3, AC-4)
  - [x] Subtask 4.1: Test that hook_strategies table is created after migrations run
  - [x] Subtask 4.2: Test that hook_strategies table has all required columns
  - [x] Subtask 4.3: Test that 5 default strategies are seeded
  - [x] Subtask 4.4: Test that each strategy has valid JSON examples
  - [x] Subtask 4.5: Verify migration is idempotent (run twice, no errors)

## Dev Notes

### Architecture Requirements

**AR-18: Database Migrations (refinery 0.8)**
- Embedded SQL migration files compiled into binary
- Versioned, forward-only migrations (no rollback — pre-migration backup instead)
- Migration file naming: `V{VERSION}__{description}.sql`
- Seed data bundled in initial migration per architecture.md: "Empty hook table causes generation failure — seeding is not optional"

**FR-5: Hook Strategy Selection**
- User can select a "Hook Strategy" (e.g., Social Proof, Contrarian, Immediate Value)
- Stories 5-2 (Hook Strategy Selection UI) depends on this seed data

### Schema Design

```sql
CREATE TABLE IF NOT EXISTS hook_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,              -- "Social Proof", "Contrarian", etc.
    description TEXT NOT NULL,               -- Brief description for UI card
    examples_json TEXT NOT NULL,             -- JSON array: ["Example 1...", "Example 2..."]
    best_for TEXT NOT NULL,                  -- "Best for: clients with clear metrics"
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Column Specifications:**
- `name`: Unique strategy name displayed in UI (Story 5-2)
- `description`: 1-2 sentence explanation of when to use this strategy
- `examples_json`: JSON array of 2-3 template opening lines, parsed for display
- `best_for`: Short phrase describing ideal use case (shown on selection cards)

**Placeholder Syntax in examples_json:**
Examples contain bracketed placeholders like `[specific outcome]`, `[metric]`, `[their problem]` that should be:
1. Displayed as-is in UI selection cards (Story 5-2) to show template structure
2. Replaced with context-specific values during proposal generation (Epic 5 stories)
3. Not treated as literal text — UI should render them distinctly (italics/highlight)

### Seed Data (from upwork-proposal-hook-library.md)

**1. Social Proof** (maps to "Right Fit" + "Numbers Don't Lie" hooks)
```json
{
  "name": "Social Proof",
  "description": "Lead with relevant experience and quantified results to build immediate credibility.",
  "examples_json": [
    "I've helped 12 clients in your industry achieve [specific outcome]...",
    "My clients see a 40% increase in [metric] on average...",
    "Just last month, I completed a nearly identical project that [result]..."
  ],
  "best_for": "Clients who value proven track records and measurable results"
}
```

**2. Contrarian** (original strategy, not in hook library)
```json
{
  "name": "Contrarian",
  "description": "Challenge conventional approaches to stand out and demonstrate deeper expertise.",
  "examples_json": [
    "Most freelancers will tell you to [common advice], but I've found that...",
    "Here's what others get wrong about [their problem]...",
    "The conventional approach to this would be X, but I recommend Y because..."
  ],
  "best_for": "Clients frustrated with generic solutions or past failed attempts"
}
```

**3. Immediate Value** (maps to "Micro-Milestone" hook)
```json
{
  "name": "Immediate Value",
  "description": "Offer a quick win or actionable insight upfront to demonstrate competence.",
  "examples_json": [
    "Here's a quick win you can implement today: [specific tip]...",
    "I can provide an initial [deliverable] within 24 hours to [benefit]...",
    "Before we even start, here's something that will help: [insight]..."
  ],
  "best_for": "Risk-averse clients or technical projects requiring trust-building"
}
```

**4. Problem-Aware** (maps to "Problem-Solver" hook)
```json
{
  "name": "Problem-Aware",
  "description": "Show you understand their pain points at a deeper level than surface symptoms.",
  "examples_json": [
    "I noticed your team is struggling with [specific pain point]...",
    "The real issue here isn't [surface problem], it's [root cause]...",
    "Looking at your requirements, I see a common pattern that causes [issue]..."
  ],
  "best_for": "Clients with complex problems or unclear requirements"
}
```

**5. Question-Based** (maps to "Curiosity Question" hook)
```json
{
  "name": "Question-Based",
  "description": "Open with a strategic question that engages the client and shows strategic thinking.",
  "examples_json": [
    "What if you could reduce costs by 30% while improving quality?",
    "Quick question: are you optimizing for speed or long-term maintainability?",
    "Have you considered how [alternative approach] might affect [their goal]?"
  ],
  "best_for": "Ambiguous job posts or projects with multiple valid approaches"
}
```

### File Structure

```
upwork-researcher/
  src-tauri/
    migrations/
      V{next}__add_hook_strategies_table.sql  # NEW: table + seed data
    src/
      db/
        mod.rs                                  # Migration runner (existing)
        queries/
          mod.rs                                # Add hook_strategies module
          hook_strategies.rs                    # NEW: query functions
```

### Testing Requirements

**Migration Tests (follow patterns from Story 1.11/1.12):**

1. **Table Creation Test:**
   - Verify hook_strategies table exists via sqlite_master

2. **Column Verification Test:**
   - Verify columns: id, name, description, examples_json, best_for, created_at
   - Use PRAGMA table_info(hook_strategies)

3. **Seed Data Verification Test:**
   - Query hook_strategies table, expect exactly 5 rows
   - Verify each strategy name exists

4. **JSON Validation Test:**
   - Parse examples_json for each strategy
   - Verify it's a valid JSON array with 2-3 elements

5. **Idempotency Test:**
   - Already covered by existing test_migrations_are_idempotent

### Scope Boundaries

**In Scope for Story 5.1:**
- Migration file with table schema + seed data
- 5 default hook strategies with examples
- db/queries/hook_strategies.rs query module
- Tests for table, schema, seed data, JSON validity

**Out of Scope (Future Stories):**
- Tauri commands for hook_strategies (get_all, get_by_id) — **added in Story 5-2**
- Hook strategy selection UI (Story 5-2)
- Custom hook strategies (Post-MVP)
- Hook strategy editing (Post-MVP)

### Dependencies

**Depends On:**
- Story 1.11: Database Migration Framework Setup (migration patterns)

**Depended On By:**
- Story 5-2: Hook Strategy Selection UI (uses hook_strategies table)
- Proposal generation pipeline (selects hook based on user choice)

### References

- [Source: epics-stories.md#Story 5.1: Hook Strategies Seed Data]
- [Source: architecture.md#AR-18: Database Migrations]
- [Source: architecture.md — "Seed data: Initial migration bundles default hook strategies"]
- [Source: upwork-proposal-hook-library.md — Hook formulas and examples]
- [Source: prd.md#FR-5: Hook strategy selection]

---

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Fix dead code warnings: analysis.rs:132 unused budget fields, job_queue.rs:188 unused insert_test_job — FIXED: removed vestigial budget fields from AnalysisResponse, added #[allow(dead_code)] to test helper
- [x] [AI-Review][MEDIUM] Update Dev Agent Record to specify test file locations (db/mod.rs vs migration/tests.rs) — FIXED: updated below
- [x] [AI-Review][MEDIUM] Clarify test count breakdown in Completion Notes — FIXED: updated below
- [x] [AI-Review][LOW] Add dependency note about Tauri commands in Story 5-2 — FIXED: added to Scope Boundaries
- [x] [AI-Review][LOW] Document placeholder syntax handling for UI in Dev Notes — FIXED: added to Schema Design

## Dev Agent Record

### Implementation Plan

**Approach:** Red-Green-Refactor TDD cycle
1. **RED**: Write failing tests for hook_strategies table, columns, seed data, JSON validation
2. **GREEN**: Create migration V19 with table schema + 5 seeded strategies
3. **REFACTOR**: Add Rust query module with get_all/get_by_id functions

**Architecture Compliance:**
- Followed AR-18 migration patterns (CREATE TABLE IF NOT EXISTS, INSERT OR IGNORE)
- Used refinery 0.8 embedded migrations
- Seed data bundled in migration (not optional per architecture.md)

### Completion Notes

**✅ All 4 Tasks Complete (2026-02-09)**

**Task 1-2: Migration V19 created**
- Table schema: id, name, description, examples_json, best_for, created_at
- 5 strategies seeded: Social Proof, Contrarian, Immediate Value, Problem-Aware, Question-Based
- Each strategy has 2-3 JSON examples matching upwork-proposal-hook-library.md patterns
- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE

**Task 3: Query module created**
- db/queries/hook_strategies.rs: HookStrategy struct + get_all/get_by_id functions
- Added to db/queries/mod.rs exports
- Follows existing query module patterns (settings.rs, user_skills.rs)

**Task 4: Comprehensive tests (10 tests total)**
- Migration tests in `db/mod.rs:1086-1224` (4 tests):
  - test_hook_strategies_table_created
  - test_hook_strategies_table_has_correct_columns
  - test_hook_strategies_seeded_with_defaults
  - test_hook_strategies_have_valid_json_examples
- Query module tests in `db/queries/hook_strategies.rs:87-200` (6 tests):
  - test_get_all_hook_strategies_returns_five
  - test_get_all_hook_strategies_names
  - test_get_hook_strategy_by_id_exists
  - test_get_hook_strategy_by_id_not_found
  - test_hook_strategy_has_valid_examples_json
  - test_hook_strategy_has_all_fields
- All 10 tests passing ✅

**Test Results:**
- ✅ 461/463 library tests passing
- ✅ All 10 hook_strategies tests passing
- ⚠️ 2 pre-existing performance test failures (unrelated to Story 5.1)

**Acceptance Criteria Validation:**
- ✅ AC-1: hook_strategies table created with all required columns
- ✅ AC-2: 5 default strategies seeded (Social Proof, Contrarian, Immediate Value, Problem-Aware, Question-Based)
- ✅ AC-3: Each strategy has 2-3 JSON examples
- ✅ AC-4: Migration is idempotent (covered by existing test_migrations_are_idempotent + CREATE IF NOT EXISTS)

---

## Change Log

**2026-02-09: Code Review Complete**
- Fixed dead code warnings: removed vestigial budget fields from AnalysisResponse (analysis.rs:129-137)
- Fixed dead code warnings: added #[allow(dead_code)] to unused test helper (job_queue.rs:188)
- Updated Dev Agent Record with precise test file locations
- Added placeholder syntax documentation to Schema Design section
- Added Tauri commands dependency note to Scope Boundaries
- All 13 hook_strategies tests passing (10 original + 3 command tests added later)

**2026-02-09: Story 5.1 Implementation Complete**
- Created migration V19__add_hook_strategies_table.sql with table schema and seed data
- Added db/queries/hook_strategies.rs query module (HookStrategy struct, get_all, get_by_id)
- Added 10 comprehensive tests (4 migration tests + 6 query module tests)
- All acceptance criteria satisfied, ready for code review
