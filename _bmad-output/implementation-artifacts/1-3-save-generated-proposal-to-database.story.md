---
status: done
assignedTo: "dev-agent"
tasksCompleted: 5
totalTasks: 5
testsWritten: true
fileList:
  - upwork-researcher/src-tauri/src/db/queries/mod.rs
  - upwork-researcher/src-tauri/src/db/queries/proposals.rs
  - upwork-researcher/src-tauri/src/db/mod.rs
  - upwork-researcher/src-tauri/src/lib.rs
  - upwork-researcher/src/stores/useGenerationStore.ts
  - upwork-researcher/src/stores/useGenerationStore.test.ts
  - upwork-researcher/src/components/ProposalOutput.tsx
  - upwork-researcher/src/components/ProposalOutput.test.tsx
  - upwork-researcher/src/App.tsx
  - upwork-researcher/src/App.css
  - upwork-researcher/src/test/setup.ts
---

# Story 1.3: Save Generated Proposal to Database

## Story

As a freelancer,
I want my generated proposals automatically saved,
So that I can access them after closing the app.

## Acceptance Criteria

**AC-1:** Given a proposal has been generated, When generation completes, Then the proposal is automatically saved to the `proposals` table.

**AC-2:** Given a proposal is saved, Then I see a subtle "Saved" indicator.

**AC-3:** Given a save operation, Then it completes in <100ms (NFR-4).

## Technical Notes

### Architecture Requirements

From architecture.md:
- Insert into proposals table
- Atomic transaction (NFR-19)
- No user confirmation needed (auto-save)
- Save operation <100ms (NFR-4)

### Database Query Pattern

From architecture.md:
- One file per entity in `db/queries/`: `proposals.rs`
- Each file exports standalone functions
- All queries use prepared statements via rusqlite's `params![]` macro

### Implementation Approach

1. Create `db/queries/proposals.rs` with insert function
2. Create Tauri command `save_proposal` that takes job_content and generated_text
3. Call save after streaming completes (in frontend or backend)
4. Emit "saved" event or return saved ID to frontend
5. Show "Saved" indicator in UI

### File Structure

```
upwork-researcher/
├── src-tauri/
│   ├── src/
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── queries/
│   │   │   │   ├── mod.rs
│   │   │   │   └── proposals.rs    # NEW: Insert proposal
│   │   ├── lib.rs                  # Add save_proposal command
├── src/
│   ├── App.tsx                     # Call save after generation
│   ├── components/
│   │   └── ProposalOutput.tsx      # Add "Saved" indicator
```

### Save Flow Options

**Option A: Frontend triggers save after generation complete**
- Frontend receives `generation:complete` event
- Frontend calls `save_proposal` command
- Simpler, more explicit

**Option B: Backend auto-saves on generation complete**
- Backend saves before emitting `generation:complete`
- Single source of truth
- Requires passing job_content through streaming

Choosing **Option A** for clarity and separation of concerns.

## Tasks/Subtasks

- [x] Task 1: Create proposals query module (AC: 1)
  - [x] Subtask 1.1: Create `src-tauri/src/db/queries/mod.rs`
  - [x] Subtask 1.2: Create `src-tauri/src/db/queries/proposals.rs`
  - [x] Subtask 1.3: Implement `insert_proposal` function with prepared statement
  - [x] Subtask 1.4: Return inserted proposal ID

- [x] Task 2: Create save_proposal Tauri command (AC: 1, 3)
  - [x] Subtask 2.1: Add `save_proposal` command to lib.rs
  - [x] Subtask 2.2: Accept job_content and generated_text parameters
  - [x] Subtask 2.3: Call insert_proposal and return result
  - [x] Subtask 2.4: Handle errors gracefully

- [x] Task 3: Integrate save into frontend flow (AC: 1)
  - [x] Subtask 3.1: Update App.tsx to call save_proposal after generation complete (useEffect)
  - [x] Subtask 3.2: Store saved state in Zustand store (isSaved, savedId)
  - [x] Subtask 3.3: Handle save errors (console.error, don't block UI)

- [x] Task 4: Add "Saved" indicator to UI (AC: 2)
  - [x] Subtask 4.1: Add `isSaved` and `savedId` state to generation store
  - [x] Subtask 4.2: Update ProposalOutput to show "Saved" indicator
  - [x] Subtask 4.3: Style the indicator subtly (green badge, light/dark mode)

- [x] Task 5: Write tests (AC: all)
  - [x] Subtask 5.1: Test insert_proposal Rust function (4 tests)
  - [x] Subtask 5.2: Test get_proposal Rust function
  - [x] Subtask 5.3: Test store isSaved/savedId states (3 new tests)
  - [x] Subtask 5.4: Test "Saved" indicator appears (3 new tests)

## Dev Notes

### NFR Targets

| NFR | Target | Validation Method |
|:----|:-------|:------------------|
| NFR-4 | Save <100ms | Time the save_proposal command |
| NFR-19 | Atomic transaction | Single INSERT statement |

### Scope Boundaries

**In scope:**
- Save proposal to database
- "Saved" indicator
- Error handling

**Out of scope:**
- View past proposals (Story 1-4)
- Edit saved proposals (Epic 6)

## References

- [Source: architecture.md#SQL Query Organization]
- [Source: epics-stories.md#Story 1.3: Save Generated Proposal to Database]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log
- Created db/queries module with proposals.rs
- Added insert_proposal and get_proposal functions
- Added save_proposal Tauri command
- Added isSaved and savedId to Zustand store
- Added useEffect in App.tsx to auto-save after generation
- Added "Saved" indicator to ProposalOutput
- Updated test setup with invoke mock

### Completion Notes
- 10 Rust tests passing (4 new proposal query tests)
- 75 frontend tests passing (6 new tests for save functionality)
- Frontend build passes
- Auto-save triggers via useEffect when fullText is set
- "Saved" indicator shows green badge next to label
- Save failures logged but don't block UI

### Implementation Summary
**Rust Backend:**
- `db/queries/proposals.rs`: insert_proposal, get_proposal functions
- `lib.rs`: save_proposal command returns `{ id, saved: true }`

**Frontend:**
- `useGenerationStore`: Added isSaved, savedId, setSaved action
- `App.tsx`: useEffect auto-saves when fullText available
- `ProposalOutput`: Shows "Saved" badge when isSaved is true
- CSS styles for saved indicator (light + dark mode)

## File List
- `upwork-researcher/src-tauri/src/db/queries/mod.rs` — NEW: Query module
- `upwork-researcher/src-tauri/src/db/queries/proposals.rs` — NEW: Proposal CRUD
- `upwork-researcher/src-tauri/src/db/mod.rs` — Export queries module
- `upwork-researcher/src-tauri/src/lib.rs` — save_proposal command
- `upwork-researcher/src/stores/useGenerationStore.ts` — isSaved, savedId, setSaved
- `upwork-researcher/src/stores/useGenerationStore.test.ts` — 3 new tests
- `upwork-researcher/src/components/ProposalOutput.tsx` — Saved indicator
- `upwork-researcher/src/components/ProposalOutput.test.tsx` — 3 new tests
- `upwork-researcher/src/App.tsx` — Auto-save useEffect
- `upwork-researcher/src/App.css` — Saved indicator styles
- `upwork-researcher/src/test/setup.ts` — invoke mock

## Change Log
- 2026-02-04: Story created
- 2026-02-04: Implementation complete — Auto-save with indicator, 10 Rust + 75 frontend tests
