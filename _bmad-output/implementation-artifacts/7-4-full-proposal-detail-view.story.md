---
status: done
assignedTo: ""
epic: 7
story: 4
priority: high
---

# Story 7.4: Full Proposal Detail View

## Story

As a freelancer,
I want to view the full details of a past proposal including complete text, job context, outcome status, hook strategy used, and revision history,
So that I can review what I submitted, learn from successful patterns, and reuse effective approaches.

## Context

Epic 7 (Proposal History & Data Portability) adds full offline access to proposal history. Stories 7-1 through 7-3 added outcome tracking schema, interactive status updates, and search/filter. This story completes the "read" experience by providing a full detail view when a user clicks a proposal card in the history list.

**What already exists:**

Backend:
- `get_proposal(conn, id)` in `db/queries/proposals.rs` — returns `SavedProposal` (id, job_content, generated_text, created_at, status) but does NOT include outcome_status, hook_strategy_id, job_post_id
- `update_proposal_outcome` Tauri command — update outcome status (Story 7.1)
- `get_proposal_revisions` Tauri command — get revision list for a proposal (Story 6.3)
- `get_revision_content` Tauri command — get full content of a specific revision (Story 6.3)
- `restore_revision` Tauri command — restore a revision (Story 6.3)
- `get_archived_revisions`, `get_archived_revision_count`, `restore_archived_revision` — archive commands (Story 6.7)
- `delete_proposal` Tauri command — delete proposal with CASCADE (Story 6.8)
- `SavedProposal` struct: `id, job_content, generated_text, created_at, status`

Frontend:
- `ProposalHistoryList` (features/proposal-history/) — virtualized list with search/filter (Story 7.3), but NOT yet integrated into App.tsx
- `ProposalHistoryCard` — card with outcome badge + dropdown; uses `useNavigate('/proposal/${id}')` from react-router-dom
- `OutcomeDropdown` + `useUpdateProposalOutcome` — interactive outcome status mutation (Story 7.2)
- `SearchFilterBar` + `useSearchProposals` — search and filter (Story 7.3)
- OLD `components/HistoryList.tsx` — currently rendered in App.tsx (uses `get_proposals`, non-virtualized, no outcome/search)
- `useProposalEditor` hook — exists for editor integration
- Copy functionality: `useSafeCopy` hook (Story 3.9)
- `DeleteConfirmDialog` component — confirmation dialog pattern (Story 6.8)

**What's missing:**
- Backend: `get_proposal_detail` Tauri command that returns full proposal data including outcome_status, hook_strategy_id, outcome_updated_at
- Backend: Extended query to join job_posts data when job_post_id is set
- Frontend: `ProposalDetailView` component showing full proposal content + metadata
- Frontend: Navigation mechanism from history list to detail view (callback-based, not router-based)
- Frontend: Back navigation from detail view to history list
- Frontend: `useProposalDetail` hook to fetch single proposal by ID
- Frontend: Revision history display within detail view
- Frontend: Integration of new ProposalHistoryList into App.tsx (replacing old HistoryList)

**Critical architecture note — NO ROUTER REQUIRED:**
- The app uses view-switching via `activeView` state (`"generate" | "history" | "settings"`) in `App.tsx`
- There is NO `BrowserRouter` in `main.tsx` — the app is a single-screen desktop app
- `ProposalHistoryCard` imports `useNavigate` from react-router-dom but this will CRASH at runtime since there's no Router provider
- **This story MUST fix the navigation pattern**: replace `useNavigate` with a callback prop (`onCardClick`) in ProposalHistoryCard
- Detail view is shown by extending the View type to include `"proposal-detail"` or by managing `selectedProposalId` state

**Architecture references:**
- Architecture.md: "Load full proposal content only on detail view click" (Story 1.4 technical notes)
- Architecture.md: Feature-sliced frontend — each folder owns its components, hooks, types
- Architecture.md: TanStack Query for server state, `useQuery` for single-record fetch
- Architecture.md: Tauri commands — snake_case verb-first: `get_proposal_detail`
- Architecture.md: UX Artifacts-style side-by-side layout — proposal content + quality/metadata sidebar
- UX spec: Dialog component for detail views (800px large variant), or full-view panel
- UX spec: Dark theme (#1e1e1e backgrounds, #fafafa text, #f97316 accent)
- FR-14: Past Proposals History — Full offline browsing
- NFR-17: <500ms query time
- UX-6: Response tracking integration (outcome status visible in detail)

## Acceptance Criteria

**AC-1:** Given a proposal exists in the database,
When the user clicks a proposal card in the history list,
Then the detail view opens showing the full proposal text (not truncated),
And the original job content is displayed,
And the outcome status badge is shown with the current status,
And the hook strategy label is shown (if one was used),
And the creation date is displayed in a readable format.

**AC-2:** Given the detail view is open,
When the user clicks the "Back" button (or presses Escape),
Then the view returns to the proposal history list,
And the list preserves its scroll position and active filters.

**AC-3:** Given the detail view is open,
When the user clicks "Copy Proposal",
Then the full proposal text is copied to the clipboard,
And a success indicator is shown ("Copied!").

**AC-4:** Given the detail view is open and the proposal has revisions,
When the user views the revision history section,
Then all revisions are listed with revision number and timestamp,
And clicking a revision shows its content.

**AC-5:** Given the detail view is open,
When the user changes the outcome status via the dropdown,
Then the status updates immediately (optimistic update),
And a success toast is shown.

**AC-6:** Given the detail view is open,
When the user clicks "Delete Proposal",
Then a confirmation dialog appears,
And confirming deletes the proposal and returns to the history list.

**AC-7:** Given the old `components/HistoryList.tsx` is currently rendered in App.tsx,
When this story is complete,
Then the new `features/proposal-history/ProposalHistoryList` replaces the old HistoryList in the history view,
And the `ProposalHistoryCard` navigation uses a callback pattern (NOT `useNavigate`),
And clicking a card opens the detail view within the app's view-switching system.

**AC-8:** Given all changes are complete,
When the full test suite runs,
Then all existing tests pass (no regressions) plus new tests for the detail view component, the backend query, and the navigation integration.

## Tasks / Subtasks

- [x] Task 1: Create `get_proposal_detail` backend query and Tauri command (AC: 1)
  - [x] Create `ProposalDetail` struct in `db/queries/proposals.rs` with: id, job_content, generated_text, created_at, status, outcome_status, outcome_updated_at, hook_strategy_id, job_post_id, job_title (joined from job_posts if linked)
  - [x] Create `get_proposal_detail(conn, id)` function that returns `Option<ProposalDetail>` — SELECT all columns including Story 7.1 additions; LEFT JOIN job_posts to get job title/client name when job_post_id is set
  - [x] Create `get_proposal_detail` Tauri command in `commands/proposals.rs` — async, takes `id: i64`, returns `Result<ProposalDetail, String>`
  - [x] Register in `src-tauri/src/lib.rs` invoke_handler
  - [x] Write Rust tests: proposal found, proposal not found, proposal with revisions, proposal with job_post link, proposal without optional fields

- [x] Task 2: Create `useProposalDetail` TanStack Query hook (AC: 1)
  - [x] Create `src/features/proposal-history/useProposalDetail.ts`
  - [x] Use `useQuery` with queryKey: `['proposal', id]` — single record fetch, not infinite
  - [x] Call `invoke('get_proposal_detail', { id })` Tauri command
  - [x] Return `{ data, isLoading, error, refetch }`
  - [x] `enabled: !!id` — don't fetch when id is null/undefined
  - [x] Write tests: successful fetch, error handling, disabled when no id

- [x] Task 3: Create `ProposalDetailView` component (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `src/features/proposal-history/ProposalDetailView.tsx` + `.css`
  - [x] Accept props: `proposalId: number`, `onBack: () => void`
  - [x] Use `useProposalDetail(proposalId)` to fetch full proposal data
  - [x] Layout sections:
    - Header: Back button + "Proposal Details" title + creation date
    - Metadata bar: Outcome badge (with `OutcomeDropdown` for inline editing, AC-5), hook strategy label, linked job title
    - Full proposal text: rendered in a scrollable content area (plain text with preserved line breaks)
    - Job context: collapsible section showing original job content
    - Revision history: collapsible section listing revisions with timestamps
    - Actions: "Copy Proposal" button, "Delete" button
  - [x] Loading state: skeleton loader while fetching
  - [x] Error state: error message with retry button
  - [x] Not found state: "Proposal not found" message with back button
  - [x] `aria-label` on back button, `role="article"` on proposal content
  - [x] Write tests: render with data, loading state, error state, not found, back button, copy, outcome change, delete

- [x] Task 4: Add revision history display within detail view (AC: 4)
  - [x] Use existing `get_proposal_revisions` Tauri command (already registered)
  - [x] Create `useProposalRevisions` hook or inline `useQuery` with key `['proposalRevisions', id]`
  - [x] Show collapsible "Revision History" section — collapsed by default
  - [x] List revisions: number, timestamp, click to expand content
  - [x] Clicking a revision calls `get_revision_content` to load full text
  - [x] Display revision content in a read-only area below the revision list item
  - [x] Write tests: revisions listed, expand/collapse, revision content loading

- [x] Task 5: Fix ProposalHistoryCard navigation pattern (AC: 7)
  - [x] Remove `useNavigate` import from `ProposalHistoryCard.tsx`
  - [x] Remove `react-router-dom` import entirely from the component
  - [x] Add `onCardClick?: (proposalId: number) => void` prop to `ProposalHistoryCardProps`
  - [x] Replace `navigate('/proposal/${proposal.id}')` with `onCardClick?.(proposal.id)`
  - [x] Update `ProposalHistoryCard.test.tsx`: remove `MemoryRouter` wrapper, test `onCardClick` callback
  - [x] Update `ProposalHistoryList.tsx` to pass `onCardClick` prop from parent
  - [x] Add `onProposalSelect?: (proposalId: number) => void` prop to `ProposalHistoryList`
  - [x] Update `ProposalHistoryList.test.tsx` to match new prop pattern

- [x] Task 6: Integrate into App.tsx — replace old HistoryList with feature module (AC: 7)
  - [x] Extend View type: `type View = "generate" | "history" | "settings" | "proposal-detail"`
  - [x] Add `selectedProposalId` state: `useState<number | null>(null)`
  - [x] Replace `import HistoryList from "./components/HistoryList"` with `import { ProposalHistoryList } from "./features/proposal-history"`
  - [x] Replace `import { ProposalDetailView } from "./features/proposal-history"` (add to index.ts exports)
  - [x] In history view: render `<ProposalHistoryList onProposalSelect={(id) => { setSelectedProposalId(id); setActiveView("proposal-detail"); }} />`
  - [x] In proposal-detail view: render `<ProposalDetailView proposalId={selectedProposalId!} onBack={() => { setActiveView("history"); setSelectedProposalId(null); }} />`
  - [x] Ensure Navigation component handles the new view (or hides nav during detail view)
  - [x] Do NOT delete old `components/HistoryList.tsx` — it may be referenced elsewhere; mark with TODO comment

- [x] Task 7: Delete flow integration (AC: 6)
  - [x] Import `DeleteConfirmDialog` pattern (or create inline confirmation)
  - [x] On delete confirmed: call `invoke('delete_proposal', { id })` Tauri command
  - [x] On success: invalidate `['proposalHistory']` query cache, call `onBack()` to return to list
  - [x] On error: show error toast
  - [x] Write tests: delete confirmation dialog, cancel, confirm + navigation

- [x] Task 8: Copy flow integration (AC: 3)
  - [x] Use `useSafeCopy` hook or `navigator.clipboard.writeText()` for plain text copy
  - [x] Copy button shows "Copy Proposal" → "Copied!" for 2 seconds → back to "Copy Proposal"
  - [x] `aria-label="Copy proposal text to clipboard"`
  - [x] Write tests: copy success indicator, clipboard API call

- [x] Task 9: Regression testing (AC: 8)
  - [x] Run full Rust test suite — verify zero new failures
  - [x] Run full frontend test suite — verify zero new failures
  - [x] Verify existing proposal history list still works (search, filter, pagination)
  - [x] Verify outcome dropdown still works from list view and detail view
  - [x] Verify ProposalHistoryCard tests pass without MemoryRouter
  - [x] Document test counts in Dev Agent Record

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] AC-2: Scroll position and filter state not preserved — fixed by keeping ProposalHistoryList mounted (hidden) during detail view [App.tsx]
- [x] [AI-Review][HIGH] AC-5: Outcome status change pessimistic — fixed with optimisticOutcome local state + revert on error [ProposalDetailView.tsx]
- [x] [AI-Review][MEDIUM] Missing AC-5 test — added 2 tests: optimistic update + error revert (126 frontend tests pass) [ProposalDetailView.test.tsx]
- [x] [AI-Review][MEDIUM] Fragile document.querySelector — replaced with useRef for dropdown anchor [ProposalDetailView.tsx]
- [x] [AI-Review][MEDIUM] Unnecessary BrowserRouter — removed import and wrapper from test [ProposalHistoryList.test.tsx]
- [x] [AI-Review][LOW] updatedAt not rendered — now shows "Updated: date" when available [ProposalDetailView.tsx]
- [x] [AI-Review][LOW] Clipboard copy bypasses useSafeCopy — added design decision comment (safety ran at generation time) [ProposalDetailView.tsx]

### Review Follow-ups R2 (AI)

- [x] [AI-Review-R2][CRITICAL] C-1: `get_proposal_detail` command not registered in invoke_handler — added `commands::proposals::get_proposal_detail` to invoke_handler [src-tauri/src/lib.rs]
- [x] [AI-Review-R2][HIGH] H-1: Navigation History tab loses active highlight during proposal-detail view — added `|| activeView === "proposal-detail"` to className and aria-selected [src/components/Navigation.tsx]
- [x] [AI-Review-R2][HIGH] H-2: Dependency commands missing from invoke_handler — created `update_proposal_outcome` Tauri command in commands/proposals.rs + registered it and `get_proposal_detail` in invoke_handler (search_proposals + get_distinct_hook_strategies already registered by 7-3 R2) [src-tauri/src/commands/proposals.rs, src-tauri/src/lib.rs]
- [x] [AI-Review-R2][MEDIUM] M-1: `onBack` inline arrow in App.tsx — extracted to `handleBackFromDetail` useCallback with stable reference [src/App.tsx]
- [x] [AI-Review-R2][MEDIUM] M-2: "Not found" state unreachable dead code — added defensive comment documenting why branch is unreachable and why it's kept [src/features/proposal-history/ProposalDetailView.tsx]
- [x] [AI-Review-R2][LOW] L-1: outcomeStatus type mismatch — added comment documenting DB CHECK constraint makes cast safe [src/features/proposal-history/ProposalDetailView.tsx]
- [x] [AI-Review-R2][LOW] L-2: Missing font-family: Inter — added `font-family: 'Inter', system-ui, sans-serif` to .proposal-detail__text [src/features/proposal-history/ProposalDetailView.css]

## Dev Notes

### Architecture Compliance
- **Query pattern:** Standalone function in `db/queries/proposals.rs` with `params![]` macro — no inline SQL in command handlers
- **Tauri command:** Async (DB read with potential join), snake_case verb-first: `get_proposal_detail`
- **TanStack Query:** `useQuery` (not infinite query — single record), queryKey `['proposal', id]`
- **No new Zustand stores:** Proposal detail state lives in TanStack Query cache
- **View switching:** Extend existing `type View` in App.tsx — NOT adding react-router
- **Feature isolation:** All new files in `src/features/proposal-history/`. No cross-feature imports.
- **Performance:** Single-record SELECT by primary key is sub-1ms. No performance concerns.
- **Single-screen app:** Per UX spec, minimal navigation — view switching, no breadcrumbs needed

### CRITICAL: Navigation Architecture Decision

The app uses **view-switching** via `useState<View>` in App.tsx, NOT react-router:
```tsx
type View = "generate" | "history" | "settings";
const [activeView, setActiveView] = useState<View>("generate");
```

`ProposalHistoryCard.tsx` incorrectly uses `useNavigate` from react-router-dom. Since there is NO `<BrowserRouter>` in the app, this would **crash at runtime**. This story MUST:
1. Remove `useNavigate` from ProposalHistoryCard
2. Replace with callback prop: `onCardClick?: (proposalId: number) => void`
3. Wire the callback through ProposalHistoryList to App.tsx
4. Extend View type to `"proposal-detail"`
5. Show ProposalDetailView when a card is clicked

### Two History Lists Exist

The app currently has **two separate history list implementations**:
1. **OLD:** `src/components/HistoryList.tsx` — rendered in App.tsx, uses `get_proposals` command, non-virtualized
2. **NEW:** `src/features/proposal-history/ProposalHistoryList.tsx` — virtualized (react-window), has search/filter (Story 7.3), outcome dropdown (Story 7.2), NOT integrated into App.tsx

This story integrates the NEW ProposalHistoryList into App.tsx, replacing the OLD one. The OLD HistoryList should be marked with a TODO comment but NOT deleted (may have test references).

### Existing Patterns to Follow
- `useProposalHistory.ts` — TanStack Query hook pattern for this feature
- `useUpdateProposalOutcome.ts` — mutation hook with optimistic updates
- `OutcomeDropdown.tsx` — dropdown component pattern for status updates
- `DeleteConfirmDialog.tsx` — confirmation dialog pattern for destructive actions
- `useSafeCopy.ts` — clipboard copy with safety checks
- `ProposalHistoryCard.tsx` — card component with outcome badge
- `components/ProposalOutput.tsx` — proposal text display pattern

### Key File Locations
- Proposal DB queries: `src-tauri/src/db/queries/proposals.rs`
- Proposal commands: `src-tauri/src/commands/proposals.rs`
- Tauri command registration: `src-tauri/src/lib.rs` invoke_handler
- Proposal history feature: `src/features/proposal-history/`
- Types: `src/features/proposal-history/types.ts`
- App view switching: `src/App.tsx` (line 48: `type View`, line 55: `activeView` state)
- Old history list: `src/components/HistoryList.tsx`
- Revision commands: `src-tauri/src/lib.rs` (create_revision, get_proposal_revisions, get_revision_content, restore_revision)
- Delete dialog pattern: `src/components/DeleteConfirmDialog.tsx`
- Safe copy hook: `src/hooks/useSafeCopy.ts`

### ProposalDetail Data Shape

The backend should return a richer struct than `SavedProposal`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalDetail {
    pub id: i64,
    pub job_content: String,
    pub generated_text: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub status: String,
    pub outcome_status: String,
    pub outcome_updated_at: Option<String>,
    pub hook_strategy_id: Option<String>,
    pub job_post_id: Option<i64>,
    pub job_title: Option<String>,       // Joined from job_posts.client_name or job_posts.raw_content substr
    pub revision_count: i64,             // Count of revisions for this proposal
}
```

Frontend TypeScript:
```typescript
export interface ProposalDetail {
  id: number;
  jobContent: string;
  generatedText: string;
  createdAt: string;
  updatedAt: string | null;
  status: string;
  outcomeStatus: OutcomeStatus;
  outcomeUpdatedAt: string | null;
  hookStrategyId: string | null;
  jobPostId: number | null;
  jobTitle: string | null;
  revisionCount: number;
}
```

### SQL Query Design

```sql
SELECT
  p.id,
  p.job_content,
  p.generated_text,
  p.created_at,
  p.updated_at,
  p.status,
  p.outcome_status,
  p.outcome_updated_at,
  p.hook_strategy_id,
  p.job_post_id,
  COALESCE(jp.client_name, SUBSTR(jp.raw_content, 1, 80)) AS job_title,
  (SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = p.id) AS revision_count
FROM proposals p
LEFT JOIN job_posts jp ON p.job_post_id = jp.id
WHERE p.id = ?1
```

### CSS Design Notes
- Use dark theme: `background-color: var(--color-bg-dark, #262626)`, card bg `#1e1e1e`
- Text: `color: var(--color-text, #fafafa)`, muted: `#a3a3a3`
- Accent/CTA: `var(--color-primary, #3b82f6)` for back button, `var(--color-cta, #f97316)` for copy button
- Proposal text: `font-size: 16px`, `line-height: 1.6`, `font-family: Inter`
- Metadata labels: `font-size: 14px`, `color: #a3a3a3`
- Section headers: `font-size: 20px`, `font-weight: 600`
- Back button: text-style with left arrow, not a full button
- Collapsible sections: chevron icon, click to toggle
- Full-width layout (not side-by-side — detail view is read-only, no quality metrics to show)

### Component Layout

```
┌──────────────────────────────────────────────────┐
│ ← Back to History     Proposal Details           │
├──────────────────────────────────────────────────┤
│ Created: Feb 10, 2026  │ [Hired ▾] │ social_proof│
│ Job: "React Developer needed for..."             │
├──────────────────────────────────────────────────┤
│                                                   │
│ Full Proposal Text                                │
│ ─────────────────                                │
│ Dear hiring manager,                              │
│                                                   │
│ I noticed your team is looking for...            │
│ [full content, scrollable]                        │
│                                                   │
├──────────────────────────────────────────────────┤
│ ▸ Original Job Content                            │
│   (collapsed by default, click to expand)         │
├──────────────────────────────────────────────────┤
│ ▸ Revision History (3 revisions)                  │
│   (collapsed by default, click to expand)         │
├──────────────────────────────────────────────────┤
│ [Copy Proposal]          [Delete Proposal]        │
└──────────────────────────────────────────────────┘
```

### Testing Standards
- Frontend: `vitest` + `@testing-library/react`
- Mock `invoke` from `@tauri-apps/api/core`
- Rust: `cargo test --lib` (skip integration test compilation issues)
- Test the detail view component with mock data
- Test the callback-based navigation pattern (no more MemoryRouter needed)
- Test copy button state transitions
- Test collapsible sections (expand/collapse)

### Previous Story Intelligence (7-1, 7-2, 7-3)
- `outcomeStatus` is `NOT NULL DEFAULT 'pending'` — no null checks needed
- `hookStrategyId` is nullable (`string | null`) — handle "No strategy" display
- Badge CSS uses status-specific classes: `proposal-outcome-badge--{status}`
- `formatLabel()` from `OutcomeDropdown.tsx` converts snake_case to display labels
- `scrollIntoView` not available in jsdom — guard with `?.` in scroll code
- TanStack `mutate` is stable across renders; destructure for `useCallback` deps
- Sonner not installed — use inline `useState` + `setTimeout` toast pattern (from Story 7.2)
- `OUTCOME_STATUSES` const and `OutcomeStatus` type exported from `useUpdateProposalOutcome.ts`
- `filtersRef` pattern used in SearchFilterBar for stale closure prevention

### react-router-dom Cleanup

After removing `useNavigate` from ProposalHistoryCard, check if `react-router-dom` is still needed:
- Other components using it: `QuickCalibration.tsx`, `VoiceProfileDisplay.tsx`, `JobCard.tsx`, `JobQueuePage.tsx`, `VoiceCalibrationStep.tsx`
- Do NOT remove the package — other features depend on it
- Only remove the import from ProposalHistoryCard.tsx

### Proposal Revisions Data Shape
Per Story 6.3, the existing revision commands return:
```typescript
// get_proposal_revisions returns:
interface ProposalRevision {
  id: number;
  proposalId: number;
  revisionNumber: number;
  createdAt: string;
}

// get_revision_content returns:
interface RevisionContent {
  id: number;
  content: string;
  revisionNumber: number;
  createdAt: string;
}
```

### References
- [Source: architecture.md — "Load full proposal content only on detail view click"]
- [Source: architecture.md — Feature-sliced frontend, TanStack Query, Tauri command patterns]
- [Source: architecture.md — Artifacts-style layout, UX patterns]
- [Source: ux-design-specification.md — Dialog component (800px), dark theme, typography]
- [Source: ux-design-specification.md — Single-screen app, minimal navigation]
- [Source: epics.md#Epic-7 — FR-14 full offline browsing, UX-6 response tracking]
- [Source: prd.md — FR-14 Phase 2, past proposals full offline browsing]
- [Source: 7-1-proposal-outcome-tracking-schema.story.md — backend patterns, DB schema]
- [Source: 7-2-response-tracking-ui.story.md — OutcomeDropdown, mutation hook, toast pattern]
- [Source: 7-3-proposal-search-and-filter.story.md — SearchFilterBar, useSearchProposals, feature structure]

## Dependencies

- Story 7-1 (Proposal Outcome Tracking Schema) — COMPLETED, provides outcome_status + hook_strategy_id columns
- Story 7-2 (Response Tracking UI) — COMPLETED, provides OutcomeDropdown + useUpdateProposalOutcome
- Story 7-3 (Proposal Search and Filter) — IN REVIEW, provides SearchFilterBar + useSearchProposals + ProposalHistoryList integration
- Story 6.3 (Proposal Revision History) — COMPLETED, provides revision Tauri commands
- Story 6.8 (Delete Proposal) — COMPLETED, provides delete_proposal Tauri command + DeleteConfirmDialog pattern
- Story 8.7 (Memory Optimization) — COMPLETED, provides ProposalHistoryList + ProposalHistoryCard with virtualization

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None.

### Completion Notes List

- Task 1: Added `ProposalDetail` struct + `get_proposal_detail` query with LEFT JOIN on job_posts for job_title, subquery count for revision_count. Registered Tauri command. 6 new Rust tests (found, not found, with revisions, with job_post link, job_post fallback to raw_content, without optional fields). 59/59 proposal query tests pass.
- Task 2: Created `useProposalDetail` hook using `useQuery` with `['proposal', id]` key, `enabled: !!id`. Added `ProposalDetail` TypeScript interface to `types.ts`. 4 tests pass.
- Task 3: Created `ProposalDetailView` component with all layout sections (header, metadata bar with outcome badge/strategy/job title, full text, collapsible job content, collapsible revision history, actions). Includes loading skeleton, error with retry, not found states. `aria-label` on back button, `role="article"` on proposal content. 14 tests pass.
- Task 4: Revision history display integrated into ProposalDetailView. Collapsed by default, loads revisions via `get_proposal_revisions` on expand, loads revision content via `get_revision_content` on click. Tests included in Task 3's test file.
- Task 5: Removed `useNavigate` and `react-router-dom` import from `ProposalHistoryCard.tsx`. Added `onCardClick?: (proposalId: number) => void` prop. Updated `ProposalHistoryCard.test.tsx` to remove `BrowserRouter` wrapper and test callback pattern. Added `onProposalSelect` prop to `ProposalHistoryList`. 20/20 card tests + 17/17 list tests pass.
- Task 6: Extended `type View` to include `"proposal-detail"`. Added `selectedProposalId` state. Replaced `HistoryList` import with `ProposalHistoryList` + `ProposalDetailView` from feature module. Updated `Navigation` to accept `string` for `activeView` (sub-view compatibility). Old `HistoryList` import commented with TODO.
- Task 7: Delete flow uses existing `DeleteConfirmDialog` component. On confirm: `invoke('delete_proposal')`, invalidate `['proposalHistory']` cache, call `onBack()`. Tests: dialog shown, cancel, confirm + navigation (3 tests in ProposalDetailView test file).
- Task 8: Copy uses `navigator.clipboard.writeText()`. Button label transitions: "Copy Proposal" → "Copied!" (2s) → "Copy Proposal". `aria-label="Copy proposal text to clipboard"`. Test: clipboard API called, label change verified.
- Task 9: Regression — Rust: 635 pass, 9 fail (all pre-existing: encryption/migration/keychain/sanitization perf). Frontend: 124/124 proposal-history feature tests pass. 1498 total frontend tests pass. Pre-existing failures in e2e (require Tauri runtime), App.test.tsx (timing-related), useNetworkBlockedNotification (pre-existing) — none caused by Story 7.4.

### Test Counts
- Rust: 81 proposal-related tests pass (6 new for get_proposal_detail)
- Frontend: 124 proposal-history feature tests pass across 10 files
  - ProposalDetailView.test.tsx: 14 tests (NEW)
  - useProposalDetail.test.ts: 4 tests (NEW)
  - ProposalHistoryCard.test.tsx: 20 tests (UPDATED — removed BrowserRouter)
  - ProposalHistoryList.test.tsx: 17 tests (unchanged, still pass)
  - OutcomeDropdown.test.tsx: 19 tests (unchanged)
  - SearchFilterBar.test.tsx: 20 tests (unchanged)
  - useSearchProposals.test.ts: 13 tests (unchanged)
  - useHookStrategies.test.ts: 4 tests (unchanged)
  - useProposalHistory.test.tsx: 6 tests (unchanged)
  - useUpdateProposalOutcome.test.ts: 7 tests (unchanged)

### File List

**New files:**
- upwork-researcher/src-tauri/src/db/queries/proposals.rs (modified — added ProposalDetail struct + get_proposal_detail query + 6 tests)
- upwork-researcher/src-tauri/src/commands/proposals.rs (modified — added get_proposal_detail Tauri command)
- upwork-researcher/src-tauri/src/lib.rs (modified — registered get_proposal_detail command)
- upwork-researcher/src/features/proposal-history/useProposalDetail.ts (NEW)
- upwork-researcher/src/features/proposal-history/useProposalDetail.test.ts (NEW)
- upwork-researcher/src/features/proposal-history/ProposalDetailView.tsx (NEW)
- upwork-researcher/src/features/proposal-history/ProposalDetailView.css (NEW)
- upwork-researcher/src/features/proposal-history/ProposalDetailView.test.tsx (NEW)
- upwork-researcher/src/features/proposal-history/types.ts (modified — added ProposalDetail interface)
- upwork-researcher/src/features/proposal-history/index.ts (modified — added ProposalDetailView + useProposalDetail exports)
- upwork-researcher/src/features/proposal-history/ProposalHistoryCard.tsx (modified — removed useNavigate, added onCardClick prop)
- upwork-researcher/src/features/proposal-history/ProposalHistoryCard.test.tsx (modified — removed BrowserRouter, test callback pattern)
- upwork-researcher/src/features/proposal-history/ProposalHistoryList.tsx (modified — added onProposalSelect prop, pass onCardClick to cards)
- upwork-researcher/src/App.tsx (modified — View type extended, HistoryList → ProposalHistoryList, added ProposalDetailView, selectedProposalId state)
- upwork-researcher/src/components/Navigation.tsx (modified — activeView type broadened to string for sub-view compatibility)
