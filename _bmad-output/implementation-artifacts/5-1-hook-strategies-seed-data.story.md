---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 4
testsWritten: false
codeReviewCompleted: false
fileList: []
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

- [ ] Task 1: Create migration for hook_strategies table (AC-1, AC-4)
  - [ ] Subtask 1.1: Create V{next}__add_hook_strategies_table.sql in migrations/ directory
  - [ ] Subtask 1.2: Define hook_strategies table schema with all required columns
  - [ ] Subtask 1.3: Use CREATE TABLE IF NOT EXISTS for idempotency

- [ ] Task 2: Seed default hook strategies (AC-2, AC-3)
  - [ ] Subtask 2.1: Insert Social Proof strategy with 3 examples from hook library
  - [ ] Subtask 2.2: Insert Contrarian strategy with 2-3 examples
  - [ ] Subtask 2.3: Insert Immediate Value strategy with 2-3 examples from hook library
  - [ ] Subtask 2.4: Insert Problem-Aware strategy with 2-3 examples from hook library
  - [ ] Subtask 2.5: Insert Question-Based strategy with 2-3 examples from hook library
  - [ ] Subtask 2.6: Use INSERT OR IGNORE for idempotency (AC-4)

- [ ] Task 3: Add Rust query module for hook_strategies (AC-1)
  - [ ] Subtask 3.1: Create db/queries/hook_strategies.rs module
  - [ ] Subtask 3.2: Implement get_all_hook_strategies() function
  - [ ] Subtask 3.3: Implement get_hook_strategy_by_id() function
  - [ ] Subtask 3.4: Add HookStrategy struct with serde derives

- [ ] Task 4: Add tests for hook_strategies (AC-1, AC-2, AC-3, AC-4)
  - [ ] Subtask 4.1: Test that hook_strategies table is created after migrations run
  - [ ] Subtask 4.2: Test that hook_strategies table has all required columns
  - [ ] Subtask 4.3: Test that 5 default strategies are seeded
  - [ ] Subtask 4.4: Test that each strategy has valid JSON examples
  - [ ] Subtask 4.5: Verify migration is idempotent (run twice, no errors)

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
