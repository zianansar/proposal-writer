---
status: ready-for-dev
---

# Story 4b.7: RSS Feed Import

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a freelancer,
I want to import multiple jobs from an RSS feed,
So that I can batch-analyze opportunities.

## Acceptance Criteria

1. **Given** I'm on the Job Import screen **When** I paste an Upwork RSS feed URL **Then** the system fetches the feed **And** extracts 10-50 job posts (depending on feed size)
2. **And** saves each to `job_posts` table with `analysis_status = 'pending_analysis'` and `source = 'rss'`
3. **And** returns immediately with confirmation: "{N} jobs imported. Analysis in progress..."
4. **And** I can navigate away to other screens without interrupting background processing
5. **And** background worker processes queue sequentially at 1 job per 2 seconds (API throttle protection)
6. **And** I see real-time progress updates: "Analyzed 5/23 jobs..." (updates every ~2 seconds via Tauri events)
7. **And** I receive notification when complete: "All 23 jobs analyzed. View queue →"

## Tasks / Subtasks

- [ ] Task 1: Add `rss` crate dependency (AC: 1)
  - [ ] 1.1 Add `rss = "2.0"` to `src-tauri/Cargo.toml` `[dependencies]`
  - [ ] 1.2 Add `regex = "1"` to Cargo.toml (for HTML tag stripping from RSS description CDATA)
  - [ ] 1.3 Verify compilation with `cargo check`

- [ ] Task 2: Create database migration for RSS import tracking (AC: 2, 5, 6)
  - [ ] 2.1 Create migration `V{next}__add_rss_import_tracking.sql` (check latest V number in `src-tauri/migrations/`)
  - [ ] 2.2 ALTER `job_posts`: add `source TEXT DEFAULT 'manual'`, `analysis_status TEXT DEFAULT 'none'`, `import_batch_id TEXT`
  - [ ] 2.3 CREATE TABLE `rss_imports` (`id` INTEGER PRIMARY KEY, `batch_id` TEXT UNIQUE NOT NULL, `feed_url` TEXT NOT NULL, `total_jobs` INTEGER DEFAULT 0, `analyzed_count` INTEGER DEFAULT 0, `failed_count` INTEGER DEFAULT 0, `status` TEXT DEFAULT 'in_progress', `created_at` TEXT DEFAULT (datetime('now')), `completed_at` TEXT)
  - [ ] 2.4 CREATE INDEX `idx_job_posts_import_batch` ON `job_posts(import_batch_id)`
  - [ ] 2.5 CREATE INDEX `idx_job_posts_analysis_status` ON `job_posts(analysis_status)`
  - [ ] 2.6 CREATE INDEX `idx_rss_imports_status` ON `rss_imports(status)`

- [ ] Task 3: Implement RSS feed parser in `src-tauri/src/job/rss.rs` (AC: 1)
  - [ ] 3.1 Create `job/` module directory with `mod.rs` if it doesn't already exist (check if 4a stories created it)
  - [ ] 3.2 Implement `RssFeedItem` struct implementing `JobInputSource` trait (from architecture)
  - [ ] 3.3 Implement `parse_rss_feed(xml_content: &str) -> Result<Vec<ParsedJob>, AppError>` function
  - [ ] 3.4 Extract per item: `title()`, `link()`, `description()` (strip HTML tags from CDATA), `pub_date()`
  - [ ] 3.5 Handle malformed items gracefully — skip bad items, log warning via `tracing::warn!`, continue parsing
  - [ ] 3.6 Cap extraction at 50 items maximum (even if feed has more)
  - [ ] 3.7 Detect duplicates by Upwork job URL (`link`) — skip items already in `job_posts`

- [ ] Task 4: Implement RSS feed URL validation and HTTP fetching (AC: 1)
  - [ ] 4.1 Validate URL format in Rust command handler (must be `https://`, should contain `upwork.com` or warn user)
  - [ ] 4.2 Fetch RSS XML using existing `reqwest` client with 10s timeout
  - [ ] 4.3 Validate response: check content-type (`application/rss+xml`, `application/xml`, `text/xml`) or accept any if body parses as valid RSS
  - [ ] 4.4 Add Upwork RSS feed domains to Rust-side network allowlist (check `http_client/` module)
  - [ ] 4.5 Handle HTTP errors clearly: 403 → "RSS feed blocked by Upwork", 404 → "Feed not found", timeout → "Feed request timed out"

- [ ] Task 5: Implement `import_rss_feed` Tauri command (AC: 2, 3)
  - [ ] 5.1 Create async Tauri command: `import_rss_feed(app: AppHandle, feed_url: String) -> Result<RssImportResult, AppError>`
  - [ ] 5.2 Validate URL → fetch RSS → parse feed (all in command body before return)
  - [ ] 5.3 Generate `batch_id` using timestamp format `rss_{YYYYMMDD_HHMMSS}`
  - [ ] 5.4 Save all parsed jobs to `job_posts` with `source = 'rss'`, `analysis_status = 'pending_analysis'`, `import_batch_id = batch_id`
  - [ ] 5.5 Create `rss_imports` record with batch metadata (feed_url, total_jobs, status)
  - [ ] 5.6 Return `RssImportResult { batch_id, total_jobs, message }` immediately to frontend
  - [ ] 5.7 **After return:** Spawn background worker via `tauri::async_runtime::spawn()` passing cloned `AppHandle`

- [ ] Task 6: Implement background analysis worker (AC: 4, 5, 6, 7)
  - [ ] 6.1 Create `process_rss_queue(app: AppHandle, batch_id: String)` async function
  - [ ] 6.2 Query all `job_posts WHERE import_batch_id = ? AND analysis_status = 'pending_analysis'`
  - [ ] 6.3 For each job: set `analysis_status = 'analyzing'` → call analysis pipeline (from 4a stories) → set `analysis_status = 'analyzed'`
  - [ ] 6.4 Rate limit: `tokio::time::sleep(Duration::from_secs(2))` between each analysis call
  - [ ] 6.5 After each job: increment `rss_imports.analyzed_count`, emit progress event
  - [ ] 6.6 On individual job error: set `analysis_status = 'error'`, increment `rss_imports.failed_count`, log error, **continue** to next job
  - [ ] 6.7 On batch completion: update `rss_imports.status = 'complete'`, set `completed_at`, emit completion event
  - [ ] 6.8 Handle DB access correctly — `rusqlite::Connection` is `!Send`, use `spawn_blocking` for DB writes inside the async worker

- [ ] Task 7: Define event constants in `events.rs` (AC: 6, 7)
  - [ ] 7.1 Add `pub const RSS_IMPORT_PROGRESS: &str = "rss:import-progress";`
  - [ ] 7.2 Add `pub const RSS_IMPORT_COMPLETE: &str = "rss:import-complete";`
  - [ ] 7.3 Add `pub const RSS_IMPORT_ERROR: &str = "rss:import-error";`
  - [ ] 7.4 Define payload structs: `RssImportProgress { batch_id, current, total, job_title }`, `RssImportComplete { batch_id, total_analyzed, failed_count }`

- [ ] Task 8: Create `RssImportDialog.tsx` frontend component (AC: 1, 3)
  - [ ] 8.1 URL input field with placeholder "Paste Upwork RSS feed URL..."
  - [ ] 8.2 "Import Jobs" button — disabled when input empty, shows "Importing..." with spinner during fetch
  - [ ] 8.3 Invoke `import_rss_feed` Tauri command on submit
  - [ ] 8.4 On success: display confirmation "{N} jobs imported. Analysis in progress..."
  - [ ] 8.5 On error: show inline error message (not modal) — e.g., "RSS feed blocked by Upwork"
  - [ ] 8.6 Create co-located `RssImportDialog.css`

- [ ] Task 9: Create `useRssImport.ts` hook for progress tracking (AC: 4, 6, 7)
  - [ ] 9.1 Listen to `rss:import-progress` events — update state `{ current, total, jobTitle }`
  - [ ] 9.2 Listen to `rss:import-complete` events — set completion state, show notification toast
  - [ ] 9.3 Listen to `rss:import-error` events — display error inline
  - [ ] 9.4 Clean up ALL listeners on unmount via `unlisten()` in `useEffect` cleanup
  - [ ] 9.5 Track active import by `batch_id` to handle multiple imports correctly

- [ ] Task 10: Create `RssImportProgress.tsx` progress display component (AC: 6, 7)
  - [ ] 10.1 Progress bar showing `current / total` with percentage fill
  - [ ] 10.2 Status text: "Analyzed 5/23 jobs..." with current job title
  - [ ] 10.3 Completion state: "All 23 jobs analyzed. View queue →" (link to job queue view, Story 4b-9)
  - [ ] 10.4 Partial failure state: "22/23 analyzed, 1 failed"
  - [ ] 10.5 Error state: full import failure (e.g., RSS blocked) with retry option
  - [ ] 10.6 Accessibility: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`, `aria-live="polite"`
  - [ ] 10.7 Create co-located `RssImportProgress.css`

- [ ] Task 11: Register commands and wire up (AC: all)
  - [ ] 11.1 Register `import_rss_feed` in `lib.rs` → `tauri::generate_handler![...]`
  - [ ] 11.2 Add `mod job;` (or `mod rss;`) to appropriate module declarations in `lib.rs`
  - [ ] 11.3 Add RSS import entry point to the Job Import screen (alongside manual paste)
  - [ ] 11.4 Verify navigation away doesn't kill spawned background task (Tauri `async_runtime::spawn` survives navigation)

- [ ] Task 12: Write tests (AC: all)
  - [ ] 12.1 Rust unit tests for RSS parser: valid Upwork feed, empty feed, malformed XML, >50 items (verify cap), missing fields on items
  - [ ] 12.2 Rust unit tests for URL validation: valid https URL, http (reject or warn), non-upwork URL (warn), empty string, garbage input
  - [ ] 12.3 Rust unit tests for HTML tag stripping from RSS description CDATA
  - [ ] 12.4 Rust unit test for duplicate detection: same link → skip
  - [ ] 12.5 Frontend tests for `RssImportDialog`: renders input + button, validates URL, shows importing state, shows confirmation, shows error
  - [ ] 12.6 Frontend tests for `RssImportProgress`: renders progress bar, updates on events, shows completion, shows partial failure
  - [ ] 12.7 Frontend tests for `useRssImport` hook: event subscription, cleanup, state transitions

## Dev Notes

### Architecture Compliance

- **AR-4 (Claude Haiku for Analysis):** Background worker calls the existing `analyze_job_post()` pipeline from Epic 4a — uses Haiku, not Sonnet
- **AR-5 (Prompt Caching):** Analysis calls should benefit from prompt caching already enabled in the analysis pipeline (system prompt + few-shot examples cached)
- **AR-8 (Pipeline Orchestration):** RSS import is a **queue feeder**, not part of the generation pipeline. It feeds jobs into `job_posts` which then get analyzed independently
- **Network Allowlisting:** Must add Upwork RSS domains (`www.upwork.com`, `www.upwork.com/ab/feed/`) to Rust-side domain allowlist. Check existing pattern in `http_client/` module
- **Rust ↔ Frontend Boundary Rule:** RSS import touches network + DB writes → **thick command** (all logic in Rust). Frontend only invokes command and listens for events
- **Error Handling:** Use `AppError` enum variants (not raw strings). Add `AppError::RssFetchFailed`, `AppError::RssParseError`, `AppError::RssBlocked` if needed

### Key Technical Decisions

**RSS Crate: `rss` v2.0.x**
- Standard RSS 2.0 parsing, minimal dependencies, well-maintained (2.4M+ downloads)
- Sync-only (fine — called after async HTTP fetch completes)
- API: `Channel::read_from(xml_bytes)` → iterate `channel.items()` → extract `title()`, `link()`, `description()`
- Alternative considered: `feed-rs` (multi-format) — overkill, Upwork uses standard RSS 2.0 only

**Background Worker Pattern (Tauri v2):**
```rust
#[tauri::command]
pub async fn import_rss_feed(
    app: tauri::AppHandle,
    feed_url: String,
) -> Result<RssImportResult, AppError> {
    // 1. Validate URL
    // 2. Fetch RSS XML via reqwest (with 10s timeout)
    // 3. Parse RSS → Vec<ParsedJob>
    // 4. Save all jobs to DB with pending_analysis status
    // 5. Create rss_imports batch record
    // 6. Spawn background worker (does NOT block return)
    let app_clone = app.clone();
    let batch_id_clone = batch_id.clone();
    tauri::async_runtime::spawn(async move {
        process_rss_queue(app_clone, batch_id_clone).await;
    });
    // 7. Return immediately
    Ok(RssImportResult { batch_id, total_jobs, message })
}
```

**Event Emission (Tauri v2 — `Emitter` trait):**
```rust
use tauri::Emitter;

// In background worker, after each job completes:
app.emit("rss:import-progress", RssImportProgress {
    batch_id: batch_id.clone(),
    current: idx + 1,
    total,
    job_title: job.title.clone(),
})?;

// On batch completion:
app.emit("rss:import-complete", RssImportComplete {
    batch_id: batch_id.clone(),
    total_analyzed: analyzed_count,
    failed_count,
})?;
```

**Frontend Event Listening:**
```typescript
import { listen, UnlistenFn } from '@tauri-apps/api/event';

useEffect(() => {
    let unlistenProgress: UnlistenFn;
    let unlistenComplete: UnlistenFn;

    const setup = async () => {
        unlistenProgress = await listen<RssImportProgress>(
            'rss:import-progress',
            (event) => setProgress(event.payload)
        );
        unlistenComplete = await listen<RssImportComplete>(
            'rss:import-complete',
            (event) => setCompleted(event.payload)
        );
    };
    setup();

    return () => {
        unlistenProgress?.();
        unlistenComplete?.();
    };
}, []);
```

**Rate Limiting:** 1 job per 2 seconds is a **business rule** for API throttle protection, not UI debounce. Implemented as `tokio::time::sleep(Duration::from_secs(2))` between analysis calls in the worker loop. This means 50 jobs ≈ 100 seconds of background processing.

**Graceful Per-Job Error Handling:**
- Individual job analysis failure → log error, set `analysis_status = 'error'`, emit error event, **continue to next job**
- Do NOT abort the entire batch for a single failure
- Final report: "22/23 analyzed, 1 failed" (not "import failed")

### Upwork RSS Feed Format

Standard Upwork RSS feeds follow RSS 2.0:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Upwork: Jobs</title>
    <link>https://www.upwork.com/</link>
    <item>
      <title>Build React Dashboard App</title>
      <link>https://www.upwork.com/jobs/~01XXXXXXXXXXXX</link>
      <description><![CDATA[
        <b>Budget</b>: $500<br/>
        Required skills: React, TypeScript, Node.js<br/>
        We need an experienced developer...
      ]]></description>
      <pubDate>Thu, 06 Feb 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

**Parsing notes:**
- `description` contains **HTML inside CDATA** — strip HTML tags to get plain text for analysis
- Use `regex::Regex::new(r"<[^>]+>").unwrap().replace_all(html, "")` for lightweight HTML stripping (no full parser needed)
- Also decode common HTML entities: `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>`, `&#39;` → `'`, `&quot;` → `"`
- `link` = Upwork job URL (use for duplicate detection)
- `title` = job title
- `pubDate` = parse to ISO 8601 and store as `posted_at`

### Database Schema Details

**`job_posts` table additions:**
```sql
-- analysis_status values: 'none', 'pending_analysis', 'analyzing', 'analyzed', 'error'
ALTER TABLE job_posts ADD COLUMN source TEXT DEFAULT 'manual';
ALTER TABLE job_posts ADD COLUMN analysis_status TEXT DEFAULT 'none';
ALTER TABLE job_posts ADD COLUMN import_batch_id TEXT;
CREATE INDEX idx_job_posts_import_batch ON job_posts(import_batch_id);
CREATE INDEX idx_job_posts_analysis_status ON job_posts(analysis_status);
```

**New `rss_imports` table:**
```sql
CREATE TABLE rss_imports (
    id INTEGER PRIMARY KEY,
    batch_id TEXT UNIQUE NOT NULL,
    feed_url TEXT NOT NULL,
    total_jobs INTEGER NOT NULL DEFAULT 0,
    analyzed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE INDEX idx_rss_imports_status ON rss_imports(status);
```

**`analysis_status` lifecycle:** `none` → `pending_analysis` (on RSS import) → `analyzing` (worker picks up) → `analyzed` (success) | `error` (failure)

**Duplicate detection query:**
```sql
SELECT id FROM job_posts WHERE raw_content_url = ? LIMIT 1
```
Use `link` from RSS as `raw_content_url`. If exists, skip — do not re-import.

### rusqlite `!Send` Handling in Background Worker

`rusqlite::Connection` is `!Send` — cannot be held across `.await` points. The background worker is async. Solution:

```rust
async fn process_rss_queue(app: AppHandle, batch_id: String) {
    // For each job in queue:
    for job_id in job_ids {
        // DB reads/writes via spawn_blocking
        let status = tokio::task::spawn_blocking(move || {
            let conn = get_db_connection(); // Acquire connection inside blocking task
            update_analysis_status(&conn, job_id, "analyzing")
        }).await.unwrap();

        // Async API call (analysis)
        let result = analyze_job_post(&app, &job_content).await;

        // DB write via spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = get_db_connection();
            save_analysis_result(&conn, job_id, &result)
        }).await.unwrap();

        // Rate limit pause
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Emit progress (AppHandle is Send + Sync)
        let _ = app.emit("rss:import-progress", progress_payload);
    }
}
```

Follow the existing pattern from `migration/mod.rs` for DB access patterns.

### Dependencies on Earlier Stories

**Hard Dependencies (MUST exist before implementing):**
- **4a-2+ (analysis.rs / analyze_job_post):** The background worker calls this to analyze each imported job. If not yet available, create a **stub** that sets `analysis_status = 'analyzed'` without actual API call, and add a `// TODO: Wire to real analysis pipeline` comment
- **4a-8 (save_job_analysis_atomic):** Atomic save of analysis results after each job
- **V3 migration (job_posts table):** Already exists

**Soft Dependencies (story works without them, enhanced with them):**
- **4b-2/3/4/5 (scoring pipeline):** After analysis, scoring can run automatically. If unavailable, jobs sit as "analyzed" without scores — still useful for queue browsing
- **4b-9 (Job Queue View):** The "View queue →" link in completion notification. If unavailable, make it a no-op or navigate to main screen

**If analysis pipeline doesn't exist yet:** Design the worker to accept a pluggable analysis function. Default to stub. This allows the RSS import infrastructure to ship independently.

### Potential Gotchas

1. **Upwork RSS may return 403** — This is EXPECTED behavior (Upwork blocks automation). Return clear error so Story 4b-8 can detect and trigger fallback to web scraping
2. **HTML in RSS `<description>`** — Contains HTML tags inside CDATA. MUST strip tags before saving to `job_posts.raw_content`. Unstripped HTML will confuse the analysis LLM
3. **Duplicate imports** — User imports same feed twice. Check `link` (Upwork job URL) against existing `job_posts`. Use `INSERT OR IGNORE` semantics or pre-check. Report: "23 new jobs imported (5 duplicates skipped)"
4. **Large feeds** — Cap at 50 items maximum. Upwork feeds typically have 10-50 items, but defend against edge cases
5. **rusqlite `!Send`** — Cannot hold Connection across `.await`. Always acquire connection fresh inside `spawn_blocking` closures
6. **Background task survival** — `tauri::async_runtime::spawn()` tasks survive frontend navigation. Verify this works when user navigates away from import screen
7. **Concurrent imports** — If user triggers import while another is running, both should work independently (tracked by separate `batch_id`). UI should show both progress indicators
8. **Empty feed** — Valid RSS with 0 items → return "No jobs found in feed" (not an error)
9. **Feed encoding** — Some RSS feeds may use non-UTF-8 encoding. `reqwest` defaults to UTF-8. Add `.text()` handling that respects response charset header

### Previous Story Intelligence

**Established patterns from Epics 0-3:**
- Tauri commands registered in `lib.rs` using `.invoke_handler(tauri::generate_handler![...])`
- Error types use `thiserror` with `AppError` enum in `errors.rs`
- Frontend invokes commands via `invoke()` from `@tauri-apps/api/core`
- Event listening pattern established by generation streaming (`generation:token` events)
- Components use co-located CSS files (e.g., `ComponentName.css`)
- Frontend tests use `@testing-library/react` with `vi.mock` for Tauri API mocking
- Rust tests use `tempfile` crate for isolated DB test environments

**Established event pattern from generation streaming:**
- Rust: `app.emit("event_name", payload)` using `Emitter` trait
- Frontend: `listen()` from `@tauri-apps/api/event`
- Cleanup: `unlisten()` in React `useEffect` cleanup
- Payload structs: `#[derive(Clone, Serialize)]`

**Key learnings from Epic 2 code reviews:**
- Always test edge cases (empty inputs, null fields)
- Focus trap and keyboard accessibility matter (caught in code review for encryption components)
- Clean up event listeners rigorously — memory leaks flagged in past reviews

### Project Structure Notes

**New files to create:**
- `src-tauri/src/job/rss.rs` — RSS parser module
- `src-tauri/src/job/mod.rs` — Job module root (if 4a stories haven't created it yet)
- `src-tauri/migrations/V{next}__add_rss_import_tracking.sql`
- `src/components/RssImportDialog.tsx` + `.css` + `.test.tsx`
- `src/components/RssImportProgress.tsx` + `.css`
- `src/hooks/useRssImport.ts`

**Files to modify:**
- `src-tauri/Cargo.toml` — Add `rss` and `regex` dependencies
- `src-tauri/src/lib.rs` — Register `import_rss_feed` command, add `mod job;`
- `src-tauri/src/events.rs` — Add RSS event constants
- `src/App.tsx` or relevant page — Wire up RSS import UI

**Naming alignment with architecture:**
- Architecture specifies `features/job-queue/components/RssImportDialog.tsx` (feature-folder pattern)
- Current codebase uses flat `src/components/` structure
- **Follow current codebase pattern** (flat components) unless feature-folder migration has happened by implementation time

### References

- [Source: architecture.md#Job Input Source Abstraction] — `JobInputSource` trait, `RssFeedItem` impl, `ParsedJob` struct
- [Source: architecture.md#Async Operations & Background Processing] — `tauri::async_runtime::spawn` pattern
- [Source: architecture.md#Tauri Event System] — Event naming convention (`feature:action`), payload structure
- [Source: architecture.md#Command Rate Limiting] — Business-rule rate limits (Rust-side)
- [Source: architecture.md#Project Structure] — `job/rss.rs` location, `http_client/` module
- [Source: architecture.md#Tauri Command Input Validation] — Validate in Rust command handler
- [Source: architecture.md#Error Handling Hierarchy] — `AppError` → frontend catch → UI rendering
- [Source: architecture.md#Connection Management] — `Mutex<Connection>`, WAL mode, `spawn_blocking` for async contexts
- [Source: prd.md#FR-3] — RSS feed batch import requirement
- [Source: prd.md#Section 7.1] — Data ingestion limited to public RSS feeds or user-pasted text
- [Source: prd.md#Section 5.1] — Zian's journey: paste RSS feed, auto-analyze in background
- [Source: epics.md#Epic 4b] — FR-3, AR-4 (Haiku for analysis), AR-5 (prompt caching)
- [Source: epics-stories.md#4b.7] — Full story with acceptance criteria
- [Source: epics-stories.md#4b.8] — RSS fallback story (depends on clear error from this story)
- [Source: ux-design-specification.md#Multi-Job Workflow] — Batch workflow UX, progress tracking patterns
- [Source: ux-design-specification.md#Progress Bar Component] — Progress bar anatomy, states, accessibility spec

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
