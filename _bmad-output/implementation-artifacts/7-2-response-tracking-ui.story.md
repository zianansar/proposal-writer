---
status: done
assignedTo: ""
epic: 7
story: 2
priority: high
---

# Story 7.2: Response Tracking UI

## Story

As a freelancer,
I want to update the outcome status of my proposals directly from the history list,
So that I can track which approaches get responses and identify successful patterns over time.

## Context

Epic 7 (Proposal History & Data Portability) adds search, filtering, analytics, and export. Story 7-1 added the schema and backend command; this story adds the interactive UI.

**What already exists (from Story 7-1):**
- `outcome_status` TEXT column on proposals (default 'pending') with 7 valid values: pending, submitted, response_received, interview, hired, no_response, rejected
- `outcome_updated_at` TEXT column updated on each status change
- `update_proposal_outcome` Tauri command in lib.rs (validates status, sets timestamp)
- `ProposalHistoryCard` shows outcome badge with status-specific colors
- `ProposalListItem` TypeScript type includes `outcomeStatus: string`
- `useProposalHistory` hook (TanStack useInfiniteQuery, queryKey: `['proposalHistory']`)

**What's missing:**
- Interactive status dropdown on the proposal history card badge
- Frontend hook to invoke `update_proposal_outcome` with optimistic updates
- Event propagation handling (badge click must not trigger card navigation)
- Toast notification on status change success/failure
- Accessible dropdown with keyboard navigation
- Query cache invalidation after status update

**UX context (UX-6):**
- "Did this proposal get a response? Yes/No/Pending" — simplified for emotional design
- Implementation exposes the full 7-value enum since analytics (Story 7-5) needs granularity
- Response tracking provides emotional closure and builds data loop for pattern recognition

**Architecture references:**
- UX-6: Response tracking: "Did this proposal get a response? Yes/No/Pending"
- Architecture.md: `outcome_status` enum, `update_proposal_outcome` command
- Toast pattern: Sonner component, bottom-right, auto-dismiss TOAST_SUCCESS_MS (3000ms)
- Cross-feature data flow: Features don't read each other's stores; use Tauri commands

## Acceptance Criteria

**AC-1:** Given a proposal is displayed in the history list with an outcome badge,
When the user clicks the outcome badge,
Then a dropdown appears showing all 7 valid outcome statuses (pending, submitted, response_received, interview, hired, no_response, rejected) with the current status highlighted.

**AC-2:** Given the outcome dropdown is open,
When the user selects a new status,
Then the `update_proposal_outcome` Tauri command is invoked with the proposal ID and new status,
And the badge updates immediately (optimistic update),
And a success toast is shown: "Outcome updated to '[status]'".

**AC-3:** Given the outcome dropdown is open,
When the user clicks the outcome badge (or a card area other than the dropdown),
Then the dropdown closes without triggering card navigation,
And clicking the badge does NOT navigate to the proposal detail view.

**AC-4:** Given the outcome dropdown is open,
When the user presses Escape,
Then the dropdown closes and focus returns to the badge,
And pressing Up/Down arrow keys navigates between status options,
And pressing Enter selects the focused option.

**AC-5:** Given a status update fails (e.g., invalid status, DB error),
When the error response is received,
Then the optimistic badge update reverts to the previous status,
And an error toast is shown with the error message.

**AC-6:** Given all changes are complete,
When the full test suite runs,
Then all existing tests pass (no regressions) plus new tests for the dropdown, hook, and keyboard navigation.

## Tasks / Subtasks

- [x] Task 1: Create `useUpdateProposalOutcome` mutation hook (AC: 2, 5)
  - [x] Create `src/features/proposal-history/useUpdateProposalOutcome.ts`
  - [x] Use TanStack `useMutation` to invoke `update_proposal_outcome` Tauri command
  - [x] Implement optimistic update: update `outcomeStatus` in queryClient cache for `['proposalHistory']` pages
  - [x] Implement rollback on error: revert cache to previous status
  - [x] Show success toast on mutation success (Sonner, auto-dismiss 3s)
  - [x] Show error toast on mutation failure (Sonner, auto-dismiss 5s)
  - [x] Write tests for success, failure, and optimistic rollback

- [x] Task 2: Create `OutcomeDropdown` component (AC: 1, 3, 4)
  - [x] Create `src/features/proposal-history/OutcomeDropdown.tsx` + `.css`
  - [x] Render dropdown with all 7 status options, current status highlighted
  - [x] Display status labels with underscores replaced by spaces, capitalized
  - [x] Use portal (`createPortal`) to render dropdown outside card bounds (virtualized list overflow)
  - [x] Position dropdown below the badge using `getBoundingClientRect()`
  - [x] Close dropdown on Escape, on click outside, or on selection
  - [x] Arrow key navigation between options (Up/Down)
  - [x] Enter key selects focused option
  - [x] `aria-expanded`, `aria-haspopup="listbox"`, `role="listbox"` on dropdown, `role="option"` on items
  - [x] Focus trap within dropdown while open
  - [x] Write tests for render, selection, keyboard nav, close behavior

- [x] Task 3: Integrate dropdown into `ProposalHistoryCard` (AC: 1, 3)
  - [x] Modify `ProposalHistoryCard.tsx` to wrap badge in clickable trigger
  - [x] Add `onClick` handler on badge that opens `OutcomeDropdown` (using `stopPropagation()`)
  - [x] Pass `onStatusChange` callback from card → dropdown → mutation hook
  - [x] Add `onStatusChange` prop to `ProposalHistoryCardProps` for testability
  - [x] Update existing tests to include new `onStatusChange` prop in mock data
  - [x] Write integration test: click badge → dropdown appears → select → badge updates

- [x] Task 4: Wire up in `ProposalHistoryList` (AC: 2)
  - [x] Import and call `useUpdateProposalOutcome` in `ProposalHistoryList.tsx`
  - [x] Pass `mutate` function as `onStatusChange` prop to each `ProposalHistoryCard`
  - [x] Update `ProposalHistoryList.test.tsx` mock data and tests

- [x] Task 5: Regression testing (AC: 6)
  - [x] Run full Rust test suite — verify zero new failures
  - [x] Run full frontend test suite — verify zero new failures
  - [x] Test that existing proposal history navigation still works
  - [x] Test that clicking card body (not badge) still navigates to detail
  - [x] Document test counts in Dev Agent Record

### Review Follow-ups (AI)

- [x] [AI-Review][M1] Fragile optimistic rollback — save entire query data snapshot in `onMutate` context instead of just `pages`, so `pageParams` is preserved on rollback [useUpdateProposalOutcome.ts:74-81]
- [x] [AI-Review][M2] Unsafe type assertion — change `outcomeStatus: string` to `outcomeStatus: OutcomeStatus` in `ProposalListItem` interface, removed unsafe cast in ProposalHistoryCard [types.ts:8, ProposalHistoryCard.tsx:107]
- [x] [AI-Review][M3] Missing `aria-activedescendant` — added `id` attributes to `<li>` options and `aria-activedescendant` on `<ul>` [OutcomeDropdown.tsx]
- [x] [AI-Review][M4] Useless `useCallback` — destructured `{ mutate }` from `useUpdateProposalOutcome()`, use `[updateOutcomeMutate]` as stable dep [ProposalHistoryList.tsx]
- [x] [AI-Review][M5] Dropdown doesn't reposition on scroll — close dropdown on any scroll event via capture-phase listener [OutcomeDropdown.tsx]
- [x] [AI-Review][L1] No viewport boundary detection — added flip-above and clamp-left logic for viewport edges [OutcomeDropdown.tsx]
- [x] [AI-Review][L2] Inconsistent text formatting — badge now uses shared `formatLabel()`, removed CSS `text-transform: capitalize` [ProposalHistoryCard.tsx, ProposalHistoryCard.css]
- [x] [AI-Review][L3] `types.ts` added to story File List [types.ts]

## Dev Notes

### Architecture Compliance
- **Mutation pattern:** TanStack `useMutation` with `onMutate` (optimistic), `onError` (rollback), `onSettled` (invalidate)
- **Toast pattern:** Use Sonner `toast.success()` / `toast.error()` matching existing pattern in `useNetworkBlockedNotification`
- **Portal pattern:** `createPortal(dropdown, document.body)` for virtualized list overflow
- **Event propagation:** `e.stopPropagation()` on badge click prevents card `onClick` navigation
- **No new Tauri commands:** Story 7-1's `update_proposal_outcome` already handles all backend logic
- **No new Zustand stores:** Use TanStack Query cache mutation (consistent with `useProposalHistory` pattern)

### Existing Patterns to Follow
- `useProposalHistory.ts` — TanStack Query pattern for this feature
- `useNetworkBlockedNotification.ts` — Toast notification pattern (Sonner)
- `ProposalHistoryCard.tsx` — Card component structure
- `ProposalHistoryCard.css` — Badge styling with `proposal-outcome-badge--{status}` classes (already exist for all 7 statuses)
- `DeleteConfirmDialog.tsx` — Portal + focus trap pattern
- `OverrideConfirmDialog.tsx` — Click outside to close pattern

### Key File Locations
- Proposal history feature: `src/features/proposal-history/`
- Toast/Sonner setup: `src/App.tsx` or `src/main.tsx` (check Sonner provider)
- Types: `src/features/proposal-history/types.ts` (ProposalListItem with outcomeStatus)
- Tauri command: `src-tauri/src/lib.rs:602` (`update_proposal_outcome`)
- DB query: `src-tauri/src/db/queries/proposals.rs:198` (`update_proposal_outcome`)

### Valid outcome_status Values
Per architecture.md and `VALID_OUTCOME_STATUSES` in proposals.rs:
`pending`, `submitted`, `response_received`, `interview`, `hired`, `no_response`, `rejected`

### Display Labels for Dropdown
| Status Value | Display Label |
|---|---|
| pending | Pending |
| submitted | Submitted |
| response_received | Response Received |
| interview | Interview |
| hired | Hired |
| no_response | No Response |
| rejected | Rejected |

### CSS Status Colors (already defined in ProposalHistoryCard.css)
- `--pending`: gray (#737373)
- `--submitted`: blue (#93c5fd)
- `--response_received`: green (#bef264)
- `--interview`: purple (#c4b5fd)
- `--hired`: bright green (#4ade80)
- `--no_response`: dim gray (#525252)
- `--rejected`: red (#fca5a5)

### Testing Standards
- Frontend tests for: OutcomeDropdown render/selection/keyboard, useUpdateProposalOutcome mutation/rollback, ProposalHistoryCard integration
- Use `vitest` + `@testing-library/react` (existing pattern)
- Mock `invoke` from `@tauri-apps/api/core` (existing pattern in ProposalHistoryList.test.tsx)
- Use `cargo test --lib` to skip integration test compilation issues (pre-existing)

### Previous Story Intelligence (7-1)
- Dev agent used Claude Opus 4.6
- Code review fixed 7 issues (1H 3M 3L): strategy key format, ON DELETE SET NULL, warning log, guard removal
- `outcomeStatus` is guaranteed non-null (`NOT NULL DEFAULT 'pending'`) — no need for defensive null checks
- Badge CSS uses `text-transform: capitalize` — display labels auto-capitalize first letter of each word
- Tests use `create_test_db()` pattern from `proposals.rs`

### Project Structure Notes
- New files go in `src/features/proposal-history/` (existing feature folder)
- Export new components/hooks from `src/features/proposal-history/index.ts`
- No new backend code needed — Story 7-1 covered all backend requirements
- This is a frontend-only story

### References
- [Source: architecture.md — outcome_status enum, toast patterns, event system]
- [Source: ux-design-specification.md — UX-6 response tracking, emotional closure]
- [Source: epics.md#Epic-7 — FR-14, UX-6 requirements]
- [Source: prd.md — FR-14 Phase 2, UX-6 response tracking]
- [Source: 7-1-proposal-outcome-tracking-schema.story.md — backend foundation, Dev Agent Record]

## Dependencies

- Story 7-1 (Proposal Outcome Tracking Schema) — COMPLETED, provides backend + schema
- No other dependencies

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `scrollIntoView` not available in jsdom — guarded with optional chaining (`?.`)
- Badge changed from `<span>` to `<button>` for interactivity — required CSS reset (border, cursor, font)
- Sonner not installed in project — implemented toast as inline `useState` + `setTimeout` pattern (matches `useNetworkBlockedNotification`)
- Existing `getByRole('button')` tests updated to use `{ name: /View proposal/ }` to disambiguate card vs badge buttons

### Completion Notes

**Story 7.2: Response Tracking UI — COMPLETE**

Implemented interactive outcome status dropdown on proposal history cards:

1. **useUpdateProposalOutcome hook** — TanStack `useMutation` with optimistic cache update on `['proposalHistory']` pages + rollback on error. Exports `OUTCOME_STATUSES` const and `OutcomeStatus` type.

2. **OutcomeDropdown component** — Portal-rendered (`createPortal`) dropdown listbox with all 7 statuses. Full keyboard nav (Arrow Up/Down, Enter to select, Escape to close). Positioned via `getBoundingClientRect()`. ARIA: `role="listbox"`, `role="option"`, `aria-selected`.

3. **ProposalHistoryCard integration** — Badge changed from `<span>` to `<button>` with `aria-haspopup="listbox"` and `aria-expanded`. Click opens dropdown with `stopPropagation()` preventing card navigation. Focus returns to badge on close.

4. **ProposalHistoryList wiring** — `useUpdateProposalOutcome` called in list, `mutate` passed as `onStatusChange` prop. Success/error toast displayed as fixed-position `role="status"` element with auto-dismiss (3s success, 5s error).

**Test counts:** 58 tests across 5 files (7 hook + 16 dropdown + 19 card + 10 list + 6 existing useProposalHistory). All passing. Frontend-only story — no new Rust code needed. Pre-existing failures (15 frontend, 9 Rust) are unrelated.

### File List

- `src/features/proposal-history/useUpdateProposalOutcome.ts` (NEW)
- `src/features/proposal-history/useUpdateProposalOutcome.test.ts` (NEW)
- `src/features/proposal-history/OutcomeDropdown.tsx` (NEW)
- `src/features/proposal-history/OutcomeDropdown.css` (NEW)
- `src/features/proposal-history/OutcomeDropdown.test.tsx` (NEW)
- `src/features/proposal-history/ProposalHistoryCard.tsx` (MODIFIED)
- `src/features/proposal-history/ProposalHistoryCard.test.tsx` (MODIFIED)
- `src/features/proposal-history/ProposalHistoryCard.css` (MODIFIED)
- `src/features/proposal-history/ProposalHistoryList.tsx` (MODIFIED)
- `src/features/proposal-history/ProposalHistoryList.test.tsx` (MODIFIED)
- `src/features/proposal-history/ProposalHistoryList.css` (MODIFIED)
- `src/features/proposal-history/index.ts` (MODIFIED)
- `src/features/proposal-history/types.ts` (MODIFIED)
