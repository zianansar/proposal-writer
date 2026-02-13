---
status: done
assignedTo: "dev-agent"
epic: 7
story: 1
priority: high
---

# Story 7.1: Proposal Outcome Tracking Schema

## Story

As a freelancer,
I want my proposals to track which hook strategy was used and what the outcome was,
So that I can later analyze which approaches work best for different job types.

## Context

Epic 7 (Proposal History & Data Portability) adds search, filtering, analytics, and export to the existing proposal history system. All subsequent stories in this epic depend on the schema additions in this story.

**What already exists:**
- `proposals` table: id, job_content, generated_text, created_at, updated_at, status, edited_count
- `proposal_revisions` table: revision tracking with CASCADE delete
- `job_posts` table: comprehensive job analysis fields (client_name, overall_score, skills, budget, hidden_needs)
- `get_proposal_history` Tauri command with pagination (limit/offset, returns excerpts)
- `ProposalHistoryList` + `ProposalHistoryCard` React components with VirtualizedList

**What's missing (per architecture.md):**
- `outcome_status` TEXT column on proposals — architecture specifies: submitted, response_received, interview, hired, no_response, rejected
- `outcome_updated_at` TEXT column on proposals — timestamp for when outcome was last updated
- `hook_strategy_id` TEXT column on proposals — which hook strategy was selected during generation
- `job_post_id` INTEGER column on proposals — link to the job_posts table for cross-referencing

**Architecture references:**
- Architecture.md specifies `outcome_status` enum column and `outcome_updated_at` timestamp on proposals
- Architecture.md specifies extracted aggregatable columns: `quality_score` (REAL), `token_cost` (REAL), `outcome_status` (TEXT) as top-level relational columns
- Module mapping: `commands/export.rs`, `commands/dashboard.rs`, `db/queries/dashboard.rs`

## Acceptance Criteria

**AC-1:** Given the proposals table exists,
When migration V27 runs,
Then the proposals table has new columns: `outcome_status` (TEXT, default 'pending'), `outcome_updated_at` (TEXT, nullable), `hook_strategy_id` (TEXT, nullable), `job_post_id` (INTEGER, nullable, FK to job_posts.id).

**AC-2:** Given a proposal is generated with a hook strategy selected,
When the proposal is saved to the database,
Then the `hook_strategy_id` column stores the strategy key (e.g., 'social_proof', 'contrarian', 'immediate_value').

**AC-3:** Given a proposal is generated from a specific job post,
When the proposal is saved to the database,
Then the `job_post_id` column stores the foreign key reference to the originating job_posts row.

**AC-4:** Given the new columns exist,
When `get_proposal_history` is called,
Then the response includes `outcome_status` and `hook_strategy_id` for each proposal (add to ProposalListItem).

**AC-5:** Given a new Tauri command `update_proposal_outcome` exists,
When called with (proposal_id, outcome_status),
Then the proposal's `outcome_status` and `outcome_updated_at` are updated.

**AC-6:** Given existing proposals have no outcome_status,
When the migration runs,
Then existing rows get `outcome_status = 'pending'` (default) and null for other new columns.

**AC-7:** Given all changes are complete,
When the full test suite runs,
Then all existing tests pass (no regressions) plus new tests for the migration, outcome update command, and updated query.

## Tasks / Subtasks

- [x] Task 1: Create migration V27 (AC: 1, 6)
  - [x] Add `outcome_status` TEXT DEFAULT 'pending' to proposals
  - [x] Add `outcome_updated_at` TEXT to proposals
  - [x] Add `hook_strategy_id` TEXT to proposals
  - [x] Add `job_post_id` INTEGER REFERENCES job_posts(id) to proposals
  - [x] Add index on `outcome_status` for filtering
  - [x] Add index on `hook_strategy_id` for analytics
  - [x] Add index on `job_post_id` for joins
  - [x] Write migration test verifying column existence and defaults

- [x] Task 2: Update proposal save to capture hook_strategy_id and job_post_id (AC: 2, 3)
  - [x] Update `save_proposal` in db/queries/proposals.rs to accept optional hook_strategy_id and job_post_id
  - [x] Update `save_proposal` command in lib.rs to accept strategy_id, resolve to name, and pass job_post_id
  - [x] Update frontend `invoke('save_proposal')` call to include selectedStrategyId and jobPostId
  - [x] Wire job_post_id from current job analysis context when saving a proposal

- [x] Task 3: Create update_proposal_outcome Tauri command (AC: 5)
  - [x] Add `update_proposal_outcome(proposal_id: i64, outcome_status: String)` to db/queries/proposals.rs
  - [x] Validate outcome_status is one of: pending, submitted, response_received, interview, hired, no_response, rejected
  - [x] Set `outcome_updated_at = datetime('now')` on update
  - [x] Register Tauri command in lib.rs invoke_handler
  - [x] Write tests for valid and invalid outcome values

- [x] Task 4: Update get_proposal_history response (AC: 4)
  - [x] Add `outcome_status` and `hook_strategy_id` to ProposalListItem struct (Rust)
  - [x] Update query_proposal_history_internal SQL to SELECT these new columns
  - [x] Update ProposalListItem TypeScript interface in features/proposal-history/types.ts
  - [x] Update ProposalHistoryCard to display outcome status (visual indicator)
  - [x] Write tests verifying new fields appear in response

- [x] Task 5: Regression testing (AC: 7)
  - [x] Run full Rust test suite — verify zero new failures
  - [x] Run full frontend test suite — verify zero new failures
  - [x] Test that existing proposals (without new columns) load correctly
  - [x] Document test counts in Dev Agent Record

## Dev Notes

### Architecture Compliance
- **Migration pattern:** Follow existing refinery migration pattern (V27__add_proposal_outcome_tracking.sql)
- **Tauri command pattern:** Follow existing command registration in lib.rs invoke_handler macro
- **Zeroizing pattern:** outcome_status is not sensitive data — no zeroize needed
- **Index pattern:** Follow V26 pattern for performance indexes

### Key File Locations
- Migrations: `src-tauri/migrations/` (SQL files, V27 is next)
- Proposal queries: `src-tauri/src/db/queries/proposals.rs`
- Tauri commands: `src-tauri/src/lib.rs` (invoke_handler registration)
- Proposal commands: `src-tauri/src/commands/proposals.rs`
- Frontend types: `src/features/proposal-history/types.ts`
- History card: `src/features/proposal-history/ProposalHistoryCard.tsx`
- History list: `src/features/proposal-history/ProposalHistoryList.tsx`

### Existing Patterns to Follow
- `save_proposal()` in proposals.rs — extend with optional params
- `get_proposal_history()` / `query_proposal_history_internal()` in commands/proposals.rs — extend response
- `ProposalListItem` in types.ts — add new fields
- Hook strategies are stored as string keys in `src-tauri/src/hooks/library.rs` (e.g., 'social_proof')

### Valid outcome_status Values
Per architecture.md: `pending`, `submitted`, `response_received`, `interview`, `hired`, `no_response`, `rejected`

### Testing Standards
- Rust unit tests for: migration, save with new columns, update_proposal_outcome, query with new fields
- Frontend tests for: ProposalHistoryCard showing outcome indicator, types consistency
- Use `cargo test --lib` to skip integration test compilation issues (pre-existing)

### References
- [Source: architecture.md — Outcome tracking section, proposals table schema]
- [Source: epics.md#Epic-7 — FR-14, UX-6 requirements]
- [Source: prd.md — FR-14 Phase 2, UX-6 response tracking]

## Dependencies

- None — this is the foundation story for Epic 7
- All other Epic 7 stories (7-2 through 7-7) depend on this schema

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
N/A

### Completion Notes
All 5 tasks implemented and verified. 18 new tests added (14 Rust + 4 frontend), all passing.

**Regression results:**
- Rust: 614 passed, 9 failed (all pre-existing — migration settings count, sanitization timing flakes, keychain test, db unlock count)
- Frontend: 1403 passed, 13 failed, 1 error (all pre-existing — useRehumanization, useProposalEditor, OnboardingWizard, App.perplexity, App.test, useNetworkBlockedNotification, accessibility-components)
- Zero new regressions introduced.

**Design decisions:**
- `hook_strategy_id` stored as snake_case key (e.g., "social_proof") — backend resolves integer strategy_id to name via `get_hook_strategy_by_id()`, then converts to key format
- `insert_proposal()` backward-compatible — delegates to new `insert_proposal_with_context()` with None defaults
- ProposalHistoryCard badge renders unconditionally (outcomeStatus is NOT NULL DEFAULT 'pending')
- Outcome badge CSS uses status-specific color variants matching dark theme palette

**Code Review Fixes (2026-02-12):**
- H1: Changed strategy storage from display name to snake_case key per AC-2 (lib.rs)
- M1: Added `ON DELETE SET NULL` to job_post_id FK (V27 SQL)
- M2: Added tracing::warn for unresolvable strategy_id (lib.rs)
- M3: Tests updated to use snake_case key format (proposals.rs, commands/proposals.rs)
- L1: Column name acknowledged via H1 key format fix
- L2: Added authoritative-source comment to VALID_OUTCOME_STATUSES (proposals.rs)
- L3: Removed unnecessary && guard on outcomeStatus render (ProposalHistoryCard.tsx)

### File List
- `src-tauri/migrations/V27__add_proposal_outcome_tracking.sql` (NEW)
- `src-tauri/src/db/queries/proposals.rs` (MODIFIED — insert_proposal_with_context, update_proposal_outcome, VALID_OUTCOME_STATUSES, 12 new tests)
- `src-tauri/src/commands/proposals.rs` (MODIFIED — ProposalListItem struct, SQL query, 2 new tests)
- `src-tauri/src/lib.rs` (MODIFIED — save_proposal extended, update_proposal_outcome command added, invoke_handler updated)
- `src/App.tsx` (MODIFIED — save_proposal invoke passes strategyId, jobPostId)
- `src/features/proposal-history/types.ts` (MODIFIED — outcomeStatus, hookStrategyId added to ProposalListItem)
- `src/features/proposal-history/ProposalHistoryCard.tsx` (MODIFIED — outcome status badge)
- `src/features/proposal-history/ProposalHistoryCard.css` (MODIFIED — badge styles, 7 status color variants)
- `src/features/proposal-history/ProposalHistoryCard.test.tsx` (MODIFIED — 4 new tests)
- `src/features/proposal-history/ProposalHistoryList.test.tsx` (MODIFIED — mock data updated with new fields)
