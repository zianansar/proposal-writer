---
status: ready-for-dev
---

# Story 4b.9: Job Queue View with Sorting

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a freelancer,
I want to see all my imported jobs in a sortable queue,
So that I can prioritize which proposals to write first.

## Acceptance Criteria

1. **Given** I have imported/analyzed multiple jobs **When** I view the Job Queue **Then** I see a list of all jobs displaying: client name, job title, skills match %, client quality %, overall score with color indicator, and created date
2. **And** each job displays a color indicator based on **component thresholds** from Story 4b-5:
   - **Green:** skills_match >= 75 AND client_quality >= 80
   - **Yellow:** skills_match 50-74 OR client_quality 60-79 (and not meeting Red criteria)
   - **Red:** skills_match < 50 OR client_quality < 60 OR zero-hire client
3. **And** the default sort order is by overall score (highest first)
4. **And** I can change sort to: date (newest first), client name (A-Z)
5. **And** I can filter by: Green only, Yellow+Green, All (default: All)
6. **And** clicking a job card navigates to proposal generation for that job (`/editor/{jobId}`)
7. **And** the queue loads in <500ms even with 100+ jobs (NFR-17)
8. **And** the list uses virtualization — only visible rows render (NFR-2: RAM <300MB)
9. **And** scrolling is smooth at 60fps even with 500+ items
10. **And** empty state shows: "No jobs in queue. Import jobs via RSS or paste manually."

## Tasks / Subtasks

- [ ] Task 1: Create database migration for score indexes (AC: 7)
  - [ ] 1.1 Create migration `V{next}__add_job_queue_indexes.sql`
  - [ ] 1.2 Add index: `CREATE INDEX IF NOT EXISTS idx_job_posts_overall_score ON job_posts(overall_score DESC)`
  - [ ] 1.3 Add index: `CREATE INDEX IF NOT EXISTS idx_job_posts_created_at ON job_posts(created_at DESC)`
  - [ ] 1.4 Add index: `CREATE INDEX IF NOT EXISTS idx_job_posts_client_name ON job_posts(client_name)`
  - [ ] 1.5 Verify indexes with `EXPLAIN QUERY PLAN` on sort queries

- [ ] Task 2: Define Rust types for job queue (AC: 1, 2)
  - [ ] 2.1 Create/update `src-tauri/src/job/types.rs`
  - [ ] 2.2 Define `JobQueueItem` struct with `#[derive(Serialize, specta::Type)]`:
    ```rust
    pub struct JobQueueItem {
        pub id: i64,
        pub client_name: String,
        pub job_title: String,
        pub skills_match_percent: Option<u8>,
        pub client_quality_percent: Option<u8>,
        pub overall_score: Option<f32>,
        pub score_color: ScoreColor,
        pub created_at: String,
    }
    ```
  - [ ] 2.3 Define `ScoreColor` enum: `Green`, `Yellow`, `Red`, `Gray` (Gray = not yet scored)
  - [ ] 2.4 Define `SortField` enum: `Score`, `Date`, `ClientName`
  - [ ] 2.5 Define `ScoreFilter` enum: `All`, `GreenOnly`, `YellowAndGreen`
  - [ ] 2.6 Define `JobQueueResponse` struct: `{ jobs: Vec<JobQueueItem>, total_count: u32, has_more: bool }`

- [ ] Task 3: Implement `get_job_queue` Tauri command (AC: 1, 3, 5, 7)
  - [ ] 3.1 Create `src-tauri/src/commands/job_queue.rs`
  - [ ] 3.2 Implement Tauri command: `get_job_queue(sort_by: SortField, filter: ScoreFilter, limit: u32, offset: u32) -> Result<JobQueueResponse, AppError>`
  - [ ] 3.3 Build SQL query selecting only: `id, client_name, job_title, skills_match_percent, client_quality_percent, overall_score, score_color, created_at`
  - [ ] 3.4 **DO NOT SELECT** heavy fields: `raw_content`, `analysis_json`, `generated_text`
  - [ ] 3.5 Implement filter logic using `score_color` column (from 4b-5):
    - `GreenOnly`: `WHERE score_color = 'green'`
    - `YellowAndGreen`: `WHERE score_color IN ('green', 'yellow')`
    - `All`: no filter
  - [ ] 3.6 Implement sort logic:
    - `Score`: `ORDER BY overall_score DESC NULLS LAST`
    - `Date`: `ORDER BY created_at DESC`
    - `ClientName`: `ORDER BY client_name ASC`
  - [ ] 3.7 Pagination with `LIMIT` and `OFFSET`
  - [ ] 3.8 Return `total_count` via separate COUNT query (for pagination UI)
  - [ ] 3.9 Add query timing: `tracing::info!("Job queue query: {:?}", start.elapsed())`

- [ ] Task 4: Create feature folder structure (AC: all)
  - [ ] 4.1 Create `src/features/job-queue/` directory
  - [ ] 4.2 Create `src/features/job-queue/components/` directory
  - [ ] 4.3 Create `src/features/job-queue/hooks/` directory
  - [ ] 4.4 Create `src/features/job-queue/types.ts` with TypeScript interfaces
  - [ ] 4.5 Create `src/features/job-queue/index.ts` for public exports

- [ ] Task 5: Create `JobQueuePage.tsx` main component (AC: 1, 6, 10)
  - [ ] 5.1 Create `src/features/job-queue/components/JobQueuePage.tsx`
  - [ ] 5.2 Layout: header with sort/filter controls, virtualized list body
  - [ ] 5.3 Use `useJobQueue` hook (TanStack Query) for data fetching
  - [ ] 5.4 Handle loading state: skeleton loader
  - [ ] 5.5 Handle error state: inline error with retry button
  - [ ] 5.6 Handle empty state: "No jobs in queue. Import jobs via RSS or paste manually." with import button
  - [ ] 5.7 Create co-located `JobQueuePage.test.tsx`

- [ ] Task 6: Create `JobCard.tsx` component (AC: 1, 2, 6)
  - [ ] 6.1 Create `src/features/job-queue/components/JobCard.tsx`
  - [ ] 6.2 Display: client name, job title (truncated to 50 chars), skills %, client quality %, score badge, date
  - [ ] 6.3 Layout: horizontal card with score badge prominent on right
  - [ ] 6.4 Hover state: subtle background highlight
  - [ ] 6.5 Click handler: navigate to `/editor/{jobId}` using React Router
  - [ ] 6.6 Format date as relative ("2h ago") using `date-fns/formatDistanceToNow`
  - [ ] 6.7 Accessibility: `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space
  - [ ] 6.8 Create co-located `JobCard.test.tsx`

- [ ] Task 7: Create `JobScoreBadge.tsx` component (AC: 2)
  - [ ] 7.1 Create `src/features/job-queue/components/JobScoreBadge.tsx`
  - [ ] 7.2 Circular badge with score number and colored background
  - [ ] 7.3 Colors: Green (#22c55e), Yellow (#eab308), Red (#ef4444), Gray (#6b7280)
  - [ ] 7.4 Size variants: `sm` (list view), `lg` (detail view)
  - [ ] 7.5 Accessibility: `role="status"`, `aria-label="Score: 85, good match"`
  - [ ] 7.6 Handle null score: display "—" with Gray background

- [ ] Task 8: Create `JobQueueControls.tsx` component (AC: 3, 4, 5)
  - [ ] 8.1 Create `src/features/job-queue/components/JobQueueControls.tsx`
  - [ ] 8.2 Sort dropdown: "Score (High→Low)" (default), "Date (Newest)", "Client (A-Z)"
  - [ ] 8.3 Filter chips: "All" (default), "Yellow+", "Green Only"
  - [ ] 8.4 Show filtered count in chip: "Green Only (12)"
  - [ ] 8.5 Keyboard accessible: arrow keys for dropdown, Enter to select
  - [ ] 8.6 Store sort/filter in URL query params (`?sort=score&filter=all`) for shareable state

- [ ] Task 9: Create `useJobQueue.ts` hook with TanStack Query (AC: 3, 5, 7)
  - [ ] 9.1 Create `src/features/job-queue/hooks/useJobQueue.ts`
  - [ ] 9.2 Use TanStack Query: `useQuery({ queryKey: ['jobQueue', sortBy, filter], queryFn: ... })`
  - [ ] 9.3 Implement via `invoke('get_job_queue', { sortBy, filter, limit: 50, offset: 0 })`
  - [ ] 9.4 Configure `staleTime: 30_000` (30 seconds)
  - [ ] 9.5 Configure `gcTime: 30 * 60 * 1000` (30 minutes per architecture)
  - [ ] 9.6 Export `useJobQueue(sortBy, filter)` returning `{ data, isLoading, error, refetch }`
  - [ ] 9.7 Export `useInvalidateJobQueue()` for cache invalidation after import

- [ ] Task 10: Implement virtualization with react-window (AC: 8, 9)
  - [ ] 10.1 Add dependencies: `npm install react-window react-virtualized-auto-sizer`
  - [ ] 10.2 Add types: `npm install -D @types/react-window`
  - [ ] 10.3 Create `JobQueueList.tsx` wrapper component
  - [ ] 10.4 Use `FixedSizeList` with row height 80px
  - [ ] 10.5 Use `AutoSizer` for responsive height
  - [ ] 10.6 Implement `itemKey` using job.id for stable keys
  - [ ] 10.7 Test smooth scrolling with 500 mock items

- [ ] Task 11: Implement infinite scroll pagination (AC: 7, 8)
  - [ ] 11.1 Use `useInfiniteQuery` from TanStack Query for pagination
  - [ ] 11.2 Load initial 50 jobs
  - [ ] 11.3 Detect scroll near bottom using `onItemsRendered` from react-window
  - [ ] 11.4 Fetch next page when user scrolls to last 10 items
  - [ ] 11.5 Show "Loading more..." at bottom during fetch
  - [ ] 11.6 Stop fetching when `has_more === false`

- [ ] Task 12: Register route and command (AC: all)
  - [ ] 12.1 Add `/` route to `JobQueuePage` in `src/router.tsx` (per architecture: JobQueue is homepage)
  - [ ] 12.2 Register `get_job_queue` command in `lib.rs` → `tauri::generate_handler![...]`
  - [ ] 12.3 Add `mod job_queue;` to `commands/mod.rs`
  - [ ] 12.4 Run `tauri-specta` to generate TypeScript types

- [ ] Task 13: Write tests (AC: all)
  - [ ] 13.1 Rust unit tests: `get_job_queue` with sort/filter combinations
  - [ ] 13.2 Rust unit tests: pagination (offset, limit, has_more logic)
  - [ ] 13.3 Rust unit tests: verify heavy columns NOT selected (mock DB, check query)
  - [ ] 13.4 Rust performance test: 100 jobs query < 500ms
  - [ ] 13.5 Frontend tests: `JobQueuePage` — renders list, empty state, loading state, error state
  - [ ] 13.6 Frontend tests: `JobCard` — displays all fields, click navigation, keyboard activation
  - [ ] 13.7 Frontend tests: `JobScoreBadge` — correct colors for each ScoreColor value
  - [ ] 13.8 Frontend tests: `useJobQueue` — fetches correctly, caches, invalidates
  - [ ] 13.9 Frontend tests: virtualization — only visible rows rendered
  - [ ] 13.10 Accessibility test: keyboard navigation through list items

## Dev Notes

### Architecture Compliance

- **Feature-sliced structure:** All components in `src/features/job-queue/` per architecture (NOT `src/components/`)
- **State Management:** TanStack Query ONLY — no Zustand store (architecture: "job-queue/ — TanStack Query only (fetch jobs, update scores)")
- **Thick Command:** `get_job_queue` is thick (DB read through encrypted layer)
- **Type Bridge:** Use `tauri-specta` for auto-generated TypeScript types from Rust structs
- **NFR-17 (<500ms):** Database indexes + selective columns + pagination
- **NFR-2 (RAM <300MB):** Virtualization ensures only ~20 DOM nodes regardless of list size
- **UX-2 (Green/Yellow/Red):** Color from component thresholds, not weighted average

### Key Technical Decisions

**Virtualization: `react-window` v1.8.x**
- Lightweight (4KB gzipped), battle-tested (16M+ downloads)
- `FixedSizeList` for uniform 80px row heights
- Combined with `react-virtualized-auto-sizer` for responsive container
- Reuse pattern from Story 8.7 per Round 6 notes

**Color Determination (from Story 4b-5):**

Color is based on **component thresholds**, NOT the weighted overall score:

```rust
fn determine_score_color(
    skills_match: Option<u8>,
    client_quality: Option<u8>,
    is_zero_hire: bool,
) -> ScoreColor {
    let skills = skills_match.unwrap_or(0);
    let quality = client_quality.unwrap_or(0);

    // Red conditions (any blocks Green/Yellow)
    if is_zero_hire || skills < 50 || quality < 60 {
        return ScoreColor::Red;
    }

    // Green requires BOTH thresholds met
    if skills >= 75 && quality >= 80 {
        return ScoreColor::Green;
    }

    // Yellow is everything else in the middle
    ScoreColor::Yellow
}
```

The `score_color` column is computed and stored in Story 4b-5. This story just reads it.

**TanStack Query Pattern (architecture-mandated):**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { JobQueueResponse, SortField, ScoreFilter } from '../types';

export function useJobQueue(sortBy: SortField, filter: ScoreFilter) {
  return useQuery({
    queryKey: ['jobQueue', sortBy, filter],
    queryFn: () => invoke<JobQueueResponse>('get_job_queue', {
      sortBy,
      filter,
      limit: 50,
      offset: 0,
    }),
    staleTime: 30_000,         // 30 seconds
    gcTime: 30 * 60 * 1000,    // 30 minutes (architecture spec)
  });
}

export function useInvalidateJobQueue() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['jobQueue'] });
}
```

**Virtualization with AutoSizer:**

```tsx
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { JobCard } from './JobCard';

const ROW_HEIGHT = 80;

export function JobQueueList({ jobs }: { jobs: JobQueueItem[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <JobCard job={jobs[index]} />
    </div>
  );

  return (
    <div className="job-queue-list-container">
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={jobs.length}
            itemSize={ROW_HEIGHT}
            itemKey={(index) => jobs[index].id}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
```

**Optimized SQL Query:**

```sql
SELECT
    id, client_name, job_title,
    skills_match_percent, client_quality_percent,
    overall_score, score_color, created_at
FROM job_posts
WHERE analysis_status = 'analyzed'
  AND ($filter = 'All'
       OR ($filter = 'GreenOnly' AND score_color = 'green')
       OR ($filter = 'YellowAndGreen' AND score_color IN ('green', 'yellow')))
ORDER BY
    CASE WHEN $sort = 'Score' THEN overall_score END DESC NULLS LAST,
    CASE WHEN $sort = 'Date' THEN created_at END DESC,
    CASE WHEN $sort = 'ClientName' THEN client_name END ASC
LIMIT $limit OFFSET $offset;
```

**Critical:** Never SELECT heavy columns (`raw_content`, `analysis_json`, etc.) — they can be KB-sized and kill query performance.

### Potential Gotchas

1. **Virtualization + keyboard nav** — `react-window` doesn't handle focus. Implement custom `onKeyDown` for arrow key navigation
2. **Empty filter results** — User filters to "Green Only" with no green jobs. Show: "No green-rated jobs. Import more or adjust your skills."
3. **NULL scores** — Jobs imported but not analyzed have NULL scores. Filter with `WHERE analysis_status = 'analyzed'` and handle NULL in UI
4. **TanStack Query cache invalidation** — After RSS import, call `invalidateQueries(['jobQueue'])` or list is stale
5. **AutoSizer parent height** — Parent must have explicit height for AutoSizer to work. Use `flex: 1` or `height: calc(100vh - header)`
6. **Row height mismatch** — If actual JobCard height differs from `ROW_HEIGHT`, scrolling is janky. Measure and match
7. **Sort stability** — Equal scores need secondary sort by `id` for consistent ordering
8. **Date formatting** — Use `date-fns` not raw Date. Handle timezone correctly (stored as UTC ISO string)

### Dependencies on Earlier Stories

**Hard Dependencies (MUST exist before implementing):**
- **4b-5 (Weighted Job Scoring Algorithm):** Computes and stores `overall_score` and `score_color`
- **4b-2, 4b-3 (Skills Match, Client Quality):** Provides percentage columns
- **4a-2 (Client Name Extraction):** Provides `client_name` column
- **1-12 (job_posts table):** Base table schema

**Soft Dependencies:**
- **4b-7 (RSS Feed Import):** Main source of jobs to display
- **8-7 (Memory Optimization):** Same react-window pattern — share code if implemented first
- **4b-6 (Scoring Breakdown UI):** Detail view when clicking job

**If scoring doesn't exist yet:** Display jobs without scores. Show "Pending" badge with Gray color. Sort by date instead.

### Previous Story Intelligence

**Established patterns from Epic 4b:**
- Tauri commands in `commands/` module
- Score color stored in DB (not computed on read)
- Job module structure

**Established patterns from architecture:**
- TanStack Query for CRUD features (no Zustand)
- Feature-sliced folder structure (`features/{name}/`)
- `tauri-specta` for type generation
- `gcTime: 30 * 60 * 1000` for TanStack Query

**From code reviews:**
- Test empty states explicitly
- Focus management for keyboard users
- Don't over-fetch — query only needed fields

### Project Structure Notes

**New files to create:**
```
src/features/job-queue/
  ├── components/
  │   ├── JobQueuePage.tsx
  │   ├── JobQueuePage.test.tsx
  │   ├── JobCard.tsx
  │   ├── JobCard.test.tsx
  │   ├── JobScoreBadge.tsx
  │   ├── JobQueueControls.tsx
  │   └── JobQueueList.tsx
  ├── hooks/
  │   └── useJobQueue.ts
  ├── types.ts
  └── index.ts

src-tauri/
  ├── src/commands/job_queue.rs
  ├── src/job/types.rs (update)
  └── migrations/V{next}__add_job_queue_indexes.sql
```

**Files to modify:**
- `src-tauri/src/commands/mod.rs` — Add `mod job_queue;`
- `src-tauri/src/lib.rs` — Register `get_job_queue` command
- `src/router.tsx` — Add `/` route to `JobQueuePage`
- `package.json` — Add dependencies

**Dependencies to add:**
```json
{
  "dependencies": {
    "react-window": "^1.8.10",
    "react-virtualized-auto-sizer": "^1.0.24",
    "date-fns": "^3.3.1"
  },
  "devDependencies": {
    "@types/react-window": "^1.8.8"
  }
}
```

### Performance Validation

**NFR-17 (<500ms query):**
```rust
#[test]
fn test_job_queue_performance() {
    // Seed 100 jobs
    let start = std::time::Instant::now();
    let result = get_job_queue(SortField::Score, ScoreFilter::All, 50, 0);
    assert!(result.is_ok());
    assert!(start.elapsed().as_millis() < 500, "Query took too long: {:?}", start.elapsed());
}
```

**NFR-2 (RAM <300MB):**
- Virtualization: Only ~20 DOM nodes rendered regardless of list size
- Verify in DevTools Memory tab: flat usage when scrolling through 500 items
- Verify in Components tab: only visible `JobCard` instances mounted

### References

- [Source: architecture.md#Feature-sliced by subsystem] — `job-queue/` folder structure
- [Source: architecture.md#Zustand Store Optionality] — "job-queue/ — TanStack Query only"
- [Source: architecture.md#Frontend Routes] — `/` maps to `JobQueuePage`
- [Source: architecture.md#TanStack Query gcTime] — 30-minute cache configuration
- [Source: ux-design-specification.md#One-Glance Decisions] — Green/Yellow/Red indicators
- [Source: ux-design-specification.md#Progressive Disclosure] — Simple by default
- [Source: prd.md#NFR-17] — UI actions <500ms
- [Source: prd.md#NFR-2] — RAM target <300MB
- [Source: epics.md#Round 6 Performance Profiler] — Index on `overall_score`
- [Source: epics-stories.md#4b.9] — Original story definition
- [Source: 4b-5-weighted-job-scoring-algorithm.story.md] — Score thresholds and color logic
- [Source: 4b-7-rss-feed-import.story.md] — "View queue" link after import
- [Source: 8-7-memory-optimization-for-large-proposal-lists.story.md] — Virtualization pattern

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
