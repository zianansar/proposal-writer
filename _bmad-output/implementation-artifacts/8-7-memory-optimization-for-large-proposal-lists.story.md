---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 7
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 8.7: Memory Optimization for Large Proposal Lists

## Story

As a freelancer with 100+ proposals,
I want the app to remain fast and responsive,
So that I can access my history quickly.

## Acceptance Criteria

**AC-1: Virtualized Proposal History List**

**Given** I have 100+ proposals in my database
**When** I view the proposal history list (Story 1.4)
**Then** the system uses virtualization (only visible rows are rendered to DOM)
**And** only ~15-20 DOM nodes exist regardless of total proposal count
**And** this can be verified in browser DevTools → Elements tab

**AC-2: Smooth Scrolling Performance**

**Given** I'm scrolling through 500+ proposals
**When** I scroll quickly up and down
**Then** scrolling remains smooth at 60fps
**And** no visible jank, stutter, or blank rows during scroll
**And** DevTools Performance tab shows no long frames (>16ms)

**AC-3: Memory Usage Target**

**Given** I have 500 proposals in my database
**When** I scroll through the entire list
**Then** app memory usage stays <300MB (NFR-2)
**And** memory doesn't grow linearly with scroll position
**And** this can be verified in DevTools → Memory tab

**AC-4: Query Performance**

**Given** I have 100+ proposals in my database
**When** I navigate to the History view
**Then** the initial list loads in <500ms (NFR-17)
**And** subsequent page loads (infinite scroll) complete in <200ms
**And** database query uses indexed `created_at` column

**AC-5: Lazy Loading with Infinite Scroll**

**Given** I'm viewing the proposal history list
**When** I scroll near the bottom (last 10 items visible)
**Then** the system automatically loads the next 50 proposals
**And** I see a loading indicator while fetching
**And** new items append seamlessly without scroll position jump
**And** fetching stops when all proposals are loaded (`has_more === false`)

**AC-6: Selective Column Loading**

**Given** the proposal list is loading
**When** the database query executes
**Then** only lightweight columns are selected: `id`, `job_excerpt`, `created_at`, `preview_text`
**And** heavy columns are NOT loaded: `generated_text`, `full_job_content`, `revision_history`
**And** full content loads only when user clicks a proposal

**AC-7: Shared Virtualization Utilities**

**Given** Story 4b.9 (Job Queue) uses the same virtualization pattern
**When** implementing this story
**Then** shared virtualization utilities are extracted to `src/lib/virtualization/`
**And** both Job Queue and Proposal History reuse the same components
**And** consistent row heights, loading states, and scroll behavior

## Tasks/Subtasks

- [ ] Task 1: Create database migration for proposal indexes (AC-4)
  - [ ] Subtask 1.1: Create migration `V10__add_proposal_history_indexes.sql`
  - [ ] Subtask 1.2: Add index: `CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC)`
  - [ ] Subtask 1.3: Verify index with `EXPLAIN QUERY PLAN` on history query
  - [ ] Subtask 1.4: Test query performance with 100+ proposals

- [ ] Task 2: Create shared virtualization utilities (AC-7)
  - [ ] Subtask 2.1: Create `src/lib/virtualization/` directory
  - [ ] Subtask 2.2: Create `VirtualizedList.tsx` wrapper component
  - [ ] Subtask 2.3: Create `useInfiniteScroll.ts` hook for pagination detection
  - [ ] Subtask 2.4: Create `VirtualizedListSkeleton.tsx` loading state
  - [ ] Subtask 2.5: Export all from `src/lib/virtualization/index.ts`
  - [ ] Subtask 2.6: Add types to `src/lib/virtualization/types.ts`

- [ ] Task 3: Implement paginated proposal query (AC-4, AC-5, AC-6)
  - [ ] Subtask 3.1: Create/update `src-tauri/src/commands/proposals.rs`
  - [ ] Subtask 3.2: Implement `get_proposal_history(limit: u32, offset: u32) -> ProposalHistoryResponse`
  - [ ] Subtask 3.3: Select ONLY: `id, job_excerpt, created_at, preview_text` (first 200 chars of generated_text)
  - [ ] Subtask 3.4: **DO NOT SELECT**: `generated_text`, `full_job_content`, `revision_history`
  - [ ] Subtask 3.5: Return `{ proposals: Vec<ProposalListItem>, total_count: u32, has_more: bool }`
  - [ ] Subtask 3.6: Add query timing log: `tracing::info!("Proposal history query: {:?}", elapsed)`

- [ ] Task 4: Create ProposalHistoryList component (AC-1, AC-2)
  - [ ] Subtask 4.1: Update `src/features/proposal-history/ProposalHistoryList.tsx`
  - [ ] Subtask 4.2: Use shared `VirtualizedList` from `src/lib/virtualization/`
  - [ ] Subtask 4.3: Configure row height: 72px
  - [ ] Subtask 4.4: Use `AutoSizer` for responsive container
  - [ ] Subtask 4.5: Implement `itemKey` using proposal.id

- [ ] Task 5: Create ProposalHistoryCard component (AC-1)
  - [ ] Subtask 5.1: Create `src/features/proposal-history/ProposalHistoryCard.tsx`
  - [ ] Subtask 5.2: Display: job excerpt (truncated), created date (relative), preview text
  - [ ] Subtask 5.3: Fixed height: 72px to match virtualization config
  - [ ] Subtask 5.4: Click handler: navigate to `/proposal/{id}` for full view
  - [ ] Subtask 5.5: Hover state and keyboard accessibility

- [ ] Task 6: Implement infinite scroll with TanStack Query (AC-5)
  - [ ] Subtask 6.1: Create `src/features/proposal-history/useProposalHistory.ts`
  - [ ] Subtask 6.2: Use `useInfiniteQuery` from TanStack Query
  - [ ] Subtask 6.3: Configure `getNextPageParam` based on `has_more` and offset
  - [ ] Subtask 6.4: Integrate with shared `useInfiniteScroll` hook
  - [ ] Subtask 6.5: Show loading indicator during page fetch
  - [ ] Subtask 6.6: Configure `staleTime: 30_000`, `gcTime: 30 * 60 * 1000`

- [ ] Task 7: Add tests and performance validation (AC-1 through AC-6)
  - [ ] Subtask 7.1: Rust test: query returns in <500ms with 100 proposals
  - [ ] Subtask 7.2: Rust test: verify heavy columns NOT in SELECT
  - [ ] Subtask 7.3: Frontend test: only ~20 DOM nodes with 500 items
  - [ ] Subtask 7.4: Frontend test: infinite scroll triggers at correct position
  - [ ] Subtask 7.5: Frontend test: loading indicator displays during fetch
  - [ ] Subtask 7.6: Performance test: no memory growth during scrolling
  - [ ] Subtask 7.7: Accessibility test: keyboard navigation through list

## Dev Notes

### Architecture Requirements

**NFR-2: RAM Target <300MB**
- Virtualization ensures constant DOM node count (~20) regardless of list size
- No full proposal content loaded until detail view
- Memory profile stays flat when scrolling

**NFR-17: UI Actions <500ms**
- Database indexes on `created_at` column
- Paginated queries (50 items per page)
- Selective column loading reduces data transfer

**AR-12: React Stack**
- react-window for virtualization (same as Story 4b.9)
- TanStack Query for data fetching with infinite scroll
- Shared utilities in `src/lib/virtualization/`

### TypeScript Types

```typescript
// src/features/proposal-history/types.ts

export interface ProposalListItem {
  id: number;
  job_excerpt: string;      // First 100 chars of job content
  preview_text: string;     // First 200 chars of generated_text
  created_at: string;       // ISO timestamp
}

export interface ProposalHistoryResponse {
  proposals: ProposalListItem[];
  total_count: number;
  has_more: boolean;
}
```

### Shared Virtualization Components

```typescript
// src/lib/virtualization/VirtualizedList.tsx

import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface VirtualizedListProps<T> {
  items: T[];
  rowHeight: number;
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  getItemKey: (item: T) => string | number;
  onItemsRendered?: (info: { visibleStopIndex: number }) => void;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  rowHeight,
  renderRow,
  getItemKey,
  onItemsRendered,
  className,
}: VirtualizedListProps<T>) {
  const Row = ({ index, style }: ListChildComponentProps) => (
    <div style={style}>
      {renderRow(items[index], index, style)}
    </div>
  );

  return (
    <div className={className} style={{ flex: 1 }}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={items.length}
            itemSize={rowHeight}
            itemKey={(index) => getItemKey(items[index])}
            onItemsRendered={onItemsRendered}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
```

### Infinite Scroll Hook

```typescript
// src/lib/virtualization/useInfiniteScroll.ts

import { useCallback } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isFetching: boolean;
  fetchNextPage: () => void;
  threshold?: number; // Items from end to trigger load
}

export function useInfiniteScroll({
  hasMore,
  isFetching,
  fetchNextPage,
  threshold = 10,
}: UseInfiniteScrollOptions) {
  const onItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }, totalItems: number) => {
      if (hasMore && !isFetching && visibleStopIndex >= totalItems - threshold) {
        fetchNextPage();
      }
    },
    [hasMore, isFetching, fetchNextPage, threshold]
  );

  return { onItemsRendered };
}
```

### Database Migration

```sql
-- migrations/V10__add_proposal_history_indexes.sql

-- Index for fast sorting by created_at (proposal history list)
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Composite index for pagination queries
CREATE INDEX IF NOT EXISTS idx_proposals_id_created ON proposals(id, created_at DESC);
```

### Rust Commands

```rust
// src-tauri/src/commands/proposals.rs

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbPool;

#[derive(Debug, Serialize, specta::Type)]
pub struct ProposalListItem {
    pub id: i64,
    pub job_excerpt: String,
    pub preview_text: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct ProposalHistoryResponse {
    pub proposals: Vec<ProposalListItem>,
    pub total_count: u32,
    pub has_more: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn get_proposal_history(
    state: State<'_, DbPool>,
    limit: u32,
    offset: u32,
) -> Result<ProposalHistoryResponse, String> {
    let start = std::time::Instant::now();
    let pool = state.0.lock().await;

    // Count total proposals
    let total_count: u32 = sqlx::query_scalar!(
        "SELECT COUNT(*) as count FROM proposals"
    )
    .fetch_one(&*pool)
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or(0) as u32;

    // Fetch paginated list with lightweight columns ONLY
    // DO NOT select: generated_text, full_job_content, revision_history
    let proposals: Vec<ProposalListItem> = sqlx::query_as!(
        ProposalListItem,
        r#"
        SELECT
            id,
            SUBSTR(job_content, 1, 100) as job_excerpt,
            SUBSTR(generated_text, 1, 200) as preview_text,
            created_at
        FROM proposals
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit as i64,
        offset as i64,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let has_more = (offset + limit) < total_count;

    tracing::info!("Proposal history query: {:?}", start.elapsed());

    Ok(ProposalHistoryResponse {
        proposals,
        total_count,
        has_more,
    })
}
```

### React Hook with Infinite Query

```typescript
// src/features/proposal-history/useProposalHistory.ts

import { useInfiniteQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { ProposalHistoryResponse } from './types';

const PAGE_SIZE = 50;

export function useProposalHistory() {
  return useInfiniteQuery({
    queryKey: ['proposalHistory'],
    queryFn: async ({ pageParam = 0 }) => {
      return invoke<ProposalHistoryResponse>('get_proposal_history', {
        limit: PAGE_SIZE,
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    staleTime: 30_000,           // 30 seconds
    gcTime: 30 * 60 * 1000,      // 30 minutes (architecture spec)
  });
}
```

### ProposalHistoryCard Component

```typescript
// src/features/proposal-history/ProposalHistoryCard.tsx

import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { ProposalListItem } from './types';

interface ProposalHistoryCardProps {
  proposal: ProposalListItem;
  style: React.CSSProperties;
}

export function ProposalHistoryCard({ proposal, style }: ProposalHistoryCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/proposal/${proposal.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      style={style}
      className="proposal-history-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="proposal-card-content">
        <div className="proposal-job-excerpt text-[#fafafa] font-medium truncate">
          {proposal.job_excerpt}
        </div>
        <div className="proposal-preview text-[#a3a3a3] text-sm truncate">
          {proposal.preview_text}
        </div>
        <div className="proposal-date text-[#737373] text-xs">
          {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
```

### File Structure

```
src/
  lib/
    virtualization/
      VirtualizedList.tsx          # NEW: Shared virtualized list component
      VirtualizedList.test.tsx     # NEW: Component tests
      VirtualizedListSkeleton.tsx  # NEW: Loading skeleton
      useInfiniteScroll.ts         # NEW: Shared infinite scroll hook
      useInfiniteScroll.test.ts    # NEW: Hook tests
      types.ts                     # NEW: Shared types
      index.ts                     # NEW: Public exports
  features/
    proposal-history/
      ProposalHistoryList.tsx      # UPDATE: Use VirtualizedList
      ProposalHistoryList.test.tsx # UPDATE: Add virtualization tests
      ProposalHistoryCard.tsx      # NEW: Individual proposal card
      ProposalHistoryCard.test.tsx # NEW: Card tests
      useProposalHistory.ts        # NEW: Infinite query hook
      useProposalHistory.test.ts   # NEW: Hook tests
      types.ts                     # NEW: TypeScript types
src-tauri/
  migrations/
    V10__add_proposal_history_indexes.sql  # NEW: Database indexes
  src/commands/
    proposals.rs                   # UPDATE: Add get_proposal_history
```

### Integration Points

**With Story 1.4 (View Past Proposals List):**
- Story 1.4 creates basic proposal list
- Story 8.7 upgrades it with virtualization and infinite scroll
- Same route (`/history`), enhanced component

**With Story 4b.9 (Job Queue View):**
- Both use same virtualization pattern (react-window)
- Shared utilities in `src/lib/virtualization/`
- Story 4b.9 can refactor to use shared components if implemented first
- If 8.7 is implemented first, 4b.9 reuses its utilities

**With Story 7.x (Proposal History Epic - Post-MVP):**
- Story 8.7 provides performance foundation
- Epic 7 adds search, filtering, tagging (builds on virtualized list)

### Dependencies

**Depends On:**
- **Story 1.4: View Past Proposals List** (BLOCKING) - Base list to optimize
- **Story 1.3: Proposal Auto-Save** - Proposals must exist in database
- **react-window, react-virtualized-auto-sizer** - NPM dependencies (may already exist from 4b.9)

**Depended On By:**
- Story 4b.9: Job Queue View (reuses virtualization utilities)
- Epic 7: Proposal History features (builds on optimized list)

**Shared Code With:**
- Story 4b.9: Job Queue View - Same virtualization pattern

### Performance Validation

**NFR-2 (RAM <300MB) Test:**
```typescript
// Manual test procedure:
// 1. Seed database with 500 proposals
// 2. Open DevTools → Memory tab
// 3. Navigate to History view
// 4. Take heap snapshot (baseline)
// 5. Scroll to bottom of list
// 6. Take heap snapshot (after scroll)
// 7. Verify: snapshot2 - snapshot1 < 50MB
```

**NFR-17 (<500ms query) Test:**
```rust
#[test]
fn test_proposal_history_performance() {
    // Seed 100 proposals
    let start = std::time::Instant::now();
    let result = get_proposal_history(50, 0);
    assert!(result.is_ok());
    assert!(
        start.elapsed().as_millis() < 500,
        "Query took {:?}ms, expected <500ms",
        start.elapsed().as_millis()
    );
}
```

**DOM Node Count Test:**
```typescript
// Frontend test
test('only renders visible rows', async () => {
  // Mock 500 proposals
  render(<ProposalHistoryList />);

  const cards = screen.getAllByRole('button');
  // With 72px row height and ~600px viewport, expect ~8-10 visible
  // react-window renders +2 overscan, so ~12-14 total
  expect(cards.length).toBeLessThan(20);
});
```

### Potential Gotchas

1. **AutoSizer parent height** — Parent container must have explicit height (`flex: 1` or `height: calc(100vh - header)`)
2. **Row height mismatch** — If ProposalHistoryCard actual height !== 72px, scrolling is janky
3. **Keyboard navigation** — react-window doesn't manage focus; implement custom arrow key handlers
4. **Empty state** — Handle zero proposals gracefully with centered message
5. **Date timezone** — `created_at` stored as UTC; use date-fns for correct local time display
6. **Query timing** — Measure query time in Rust, not frontend (includes IPC overhead)
7. **Cache invalidation** — After creating new proposal, invalidate `proposalHistory` query

### Testing Requirements

**Rust Unit Tests:**
1. `get_proposal_history` returns correct pagination
2. Query excludes heavy columns (mock DB, verify SQL)
3. Query uses index (check EXPLAIN output)
4. Performance: <500ms with 100 proposals

**Frontend Component Tests:**
1. VirtualizedList renders only visible items
2. ProposalHistoryCard displays all fields correctly
3. Click navigation works
4. Keyboard activation (Enter/Space) works
5. Loading skeleton displays during fetch

**Integration Tests:**
1. Infinite scroll loads more items at threshold
2. "Loading more..." indicator appears during fetch
3. Scroll position preserved during page load
4. New proposal appears at top after creation

**Accessibility Tests:**
1. Keyboard navigation through list items
2. Screen reader announces proposal details
3. Focus management during infinite scroll

### References

- [Source: epics-stories.md#Story 8.7: Memory Optimization]
- [Source: prd.md#NFR-2: RAM target <300MB]
- [Source: prd.md#NFR-17: UI actions <500ms]
- [Source: architecture.md#TanStack Query gcTime: 30 minutes]
- [Story 1.4: View Past Proposals List — base component]
- [Story 4b.9: Job Queue View — shared virtualization pattern]
- [react-window documentation: https://react-window.vercel.app/]
