---
status: ready-for-dev
---

# Story 4b.8: RSS Feed Fallback to Web Scraping

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a freelancer,
I want the app to still work if Upwork blocks RSS feeds,
So that I can continue importing jobs.

## Acceptance Criteria

1. **Given** RSS feed import fails with 403 Forbidden, timeout, or invalid feed **When** the error is detected **Then** the system shows: "RSS blocked. Trying alternative method..."
2. **And** automatically falls back to web scraping the Upwork search page
3. **And** extracts job listings from HTML using the same selectors as RSS (title, link, description snippet)
4. **And** saves extracted jobs to `job_posts` with `source = 'scrape'`
5. **And** if scraping also fails (Upwork changes HTML structure, IP blocked), shows clear error: "Both RSS and scraping failed. Please paste job manually."
6. **And** provides a "Try Manual Paste" button that navigates to manual paste input
7. **And** the entire fallback chain completes within 15 seconds timeout (RSS 10s + scrape 5s)

## Tasks / Subtasks

- [ ] Task 1: Add `scraper` crate dependency (AC: 2, 3)
  - [ ] 1.1 Add `scraper = "0.19"` to `src-tauri/Cargo.toml` `[dependencies]`
  - [ ] 1.2 Verify compilation with `cargo check`
  - [ ] 1.3 Review `scraper` API: `Html::parse_document()`, `Selector::parse()`, `select()`

- [ ] Task 2: Implement Upwork HTML scraper in `src-tauri/src/job/scraper.rs` (AC: 2, 3, 4)
  - [ ] 2.1 Create `job/scraper.rs` module
  - [ ] 2.2 Implement `WebScraperItem` struct implementing `JobInputSource` trait
  - [ ] 2.3 Implement `scrape_upwork_search(html: &str) -> Result<Vec<ParsedJob>, AppError>` function
  - [ ] 2.4 Define CSS selectors for Upwork job cards (job title, job URL, snippet)
  - [ ] 2.5 Extract job data from each matched element
  - [ ] 2.6 Handle missing fields gracefully — skip job if title or link missing, log warning
  - [ ] 2.7 Cap extraction at 50 items (same as RSS)
  - [ ] 2.8 Detect duplicates by job URL — skip items already in `job_posts`

- [ ] Task 3: Implement fallback HTTP fetching for search page (AC: 2, 7)
  - [ ] 3.1 Create `fetch_upwork_search_page(search_url: &str) -> Result<String, AppError>` function
  - [ ] 3.2 Convert RSS feed URL to equivalent search page URL (see Dev Notes)
  - [ ] 3.3 Fetch HTML using `reqwest` client with 5s timeout (separate from RSS 10s)
  - [ ] 3.4 Add Upwork search page domains to network allowlist
  - [ ] 3.5 Set browser-like User-Agent header to avoid immediate blocking
  - [ ] 3.6 Handle HTTP errors: 403 → `AppError::ScrapeBlocked`, 429 → `AppError::RateLimited`, timeout → `AppError::ScrapeTimeout`

- [ ] Task 4: Implement fallback chain orchestration (AC: 1, 2, 5, 7)
  - [ ] 4.1 Modify `import_rss_feed` command to catch RSS errors and trigger fallback
  - [ ] 4.2 Create `import_with_fallback(app: AppHandle, feed_url: String) -> Result<ImportResult, AppError>` orchestrator
  - [ ] 4.3 Try RSS first → on failure, emit progress event "RSS blocked. Trying alternative method..."
  - [ ] 4.4 Try web scraping → on failure, return composite error with both failure reasons
  - [ ] 4.5 Track which method succeeded in `ImportResult { source: JobSource, ... }`
  - [ ] 4.6 Total timeout enforcement: 15 seconds max for entire chain

- [ ] Task 5: Add new error types and events (AC: 1, 5)
  - [ ] 5.1 Add `AppError::ScrapeBlocked`, `AppError::ScrapeTimeout`, `AppError::ScrapeParseFailed`, `AppError::AllImportMethodsFailed`
  - [ ] 5.2 Add event constants: `pub const RSS_FALLBACK_STARTED: &str = "rss:fallback-started";`
  - [ ] 5.3 Add event constants: `pub const SCRAPE_FAILED: &str = "rss:scrape-failed";`
  - [ ] 5.4 Define payload: `RssFallbackStarted { original_error: String }`

- [ ] Task 6: Update database schema for scrape source (AC: 4)
  - [ ] 6.1 Verify `job_posts.source` column from 4b-7 accepts 'manual', 'rss', 'scrape' values
  - [ ] 6.2 If needed, update CHECK constraint or enum documentation
  - [ ] 6.3 Add `import_method` to `rss_imports` table to track which fallback succeeded

- [ ] Task 7: Update frontend for fallback feedback (AC: 1, 5, 6)
  - [ ] 7.1 Update `useRssImport.ts` hook to listen for `rss:fallback-started` event
  - [ ] 7.2 Display fallback status: "RSS blocked. Trying alternative method..." with spinner
  - [ ] 7.3 On `AllImportMethodsFailed` error, show "Both RSS and scraping failed. Please paste job manually."
  - [ ] 7.4 Add "Try Manual Paste" button that navigates to manual paste input screen
  - [ ] 7.5 Update `RssImportProgress.tsx` to show fallback chain status

- [ ] Task 8: Create selector resilience layer (AC: 5)
  - [ ] 8.1 Define multiple CSS selector variants for each data field (primary + fallbacks)
  - [ ] 8.2 Try selectors in order until one matches
  - [ ] 8.3 Log warning when primary selector fails but fallback succeeds (indicates Upwork HTML changed)
  - [ ] 8.4 If all selectors fail for >80% of expected items, return `AppError::ScrapeParseFailed`

- [ ] Task 9: Write tests (AC: all)
  - [ ] 9.1 Rust unit tests for HTML scraper: valid Upwork HTML fixture, empty results, malformed HTML
  - [ ] 9.2 Rust unit tests for selector resilience: primary fails → fallback works
  - [ ] 9.3 Rust unit tests for URL conversion: RSS URL → search page URL
  - [ ] 9.4 Rust integration tests for fallback chain: RSS fails → scrape succeeds, both fail
  - [ ] 9.5 Frontend tests for fallback status display
  - [ ] 9.6 Frontend tests for "Try Manual Paste" button navigation

- [ ] Task 10: Register and wire up (AC: all)
  - [ ] 10.1 Add `mod scraper;` to `job/mod.rs`
  - [ ] 10.2 Update `import_rss_feed` command to use fallback orchestrator
  - [ ] 10.3 Verify existing RSS import UI works with fallback (no UI changes needed for happy path)

## Dev Notes

### Architecture Compliance

- **AR-8 (Pipeline Orchestration):** Fallback is a **transport layer concern**, not pipeline. The `JobInputSource` abstraction handles this — `WebScraperItem` is just another implementation alongside `RssFeedItem`
- **Network Allowlisting:** Must add Upwork search page domains to Rust-side allowlist. Already added `www.upwork.com` in 4b-7, verify search paths are covered
- **Error Handling:** Use `AppError` enum with specific variants. Composite errors should include both failure reasons
- **Graceful Degradation Pattern (from PRD Round 4 Hindsight):** RSS → scraping → manual paste. This is the canonical fallback chain

### Key Technical Decisions

**Scraper Crate: `scraper` v0.19.x**
- CSS selector-based HTML parsing (jQuery-style)
- Battle-tested (30M+ downloads), minimal dependencies
- API: `Html::parse_document(html)` → `doc.select(&selector)` → iterate matches
- Alternative considered: `select.rs` — less mature, fewer features

**RSS URL to Search URL Conversion:**

Upwork RSS feed URLs follow this pattern:
```
https://www.upwork.com/ab/feed/jobs/rss?q=react+developer&...
```

Convert to search page URL:
```
https://www.upwork.com/nx/search/jobs/?q=react+developer&...
```

```rust
fn rss_url_to_search_url(rss_url: &str) -> Result<String, AppError> {
    let url = Url::parse(rss_url)?;

    // Extract query params from RSS URL
    let query_string = url.query().unwrap_or_default();

    // Construct search page URL
    Ok(format!("https://www.upwork.com/nx/search/jobs/?{}", query_string))
}
```

**Upwork Job Card HTML Structure (as of Feb 2026):**

```html
<section class="air3-card-section">
  <article data-test="JobTile">
    <a class="job-title-link" href="/jobs/~01XXXXXXXXXXXX">
      <h2>Build React Dashboard</h2>
    </a>
    <div class="job-description">
      <p>We need an experienced developer...</p>
    </div>
  </article>
</section>
```

**Primary CSS Selectors:**
```rust
const JOB_CARD_SELECTOR: &str = "article[data-test='JobTile']";
const TITLE_SELECTOR: &str = "a.job-title-link h2, .job-title";
const LINK_SELECTOR: &str = "a.job-title-link, a[href*='/jobs/~']";
const DESCRIPTION_SELECTOR: &str = ".job-description p, .job-description";
```

**Selector Resilience Pattern:**
```rust
fn try_selectors<'a>(element: &'a ElementRef, selectors: &[&str]) -> Option<String> {
    for selector_str in selectors {
        if let Ok(selector) = Selector::parse(selector_str) {
            if let Some(el) = element.select(&selector).next() {
                let text = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() {
                    return Some(text);
                }
            }
        }
    }
    None
}
```

**Fallback Chain Implementation:**
```rust
pub async fn import_with_fallback(
    app: AppHandle,
    feed_url: String,
) -> Result<ImportResult, AppError> {
    // Try RSS first
    match fetch_and_parse_rss(&feed_url).await {
        Ok(jobs) => {
            return save_jobs_and_start_analysis(app, jobs, JobSource::Rss).await;
        }
        Err(rss_error) => {
            // Emit fallback event
            let _ = app.emit("rss:fallback-started", RssFallbackStarted {
                original_error: rss_error.to_string(),
            });

            // Try scraping
            let search_url = rss_url_to_search_url(&feed_url)?;
            match fetch_and_scrape_search(&search_url).await {
                Ok(jobs) => {
                    return save_jobs_and_start_analysis(app, jobs, JobSource::Scrape).await;
                }
                Err(scrape_error) => {
                    // Both failed
                    return Err(AppError::AllImportMethodsFailed {
                        rss_error: Box::new(rss_error),
                        scrape_error: Box::new(scrape_error),
                    });
                }
            }
        }
    }
}
```

**Browser-Like Request Headers:**
```rust
let response = client
    .get(&search_url)
    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    .header("Accept", "text/html,application/xhtml+xml")
    .header("Accept-Language", "en-US,en;q=0.9")
    .timeout(Duration::from_secs(5))
    .send()
    .await?;
```

### Potential Gotchas

1. **Upwork HTML changes frequently** — Selectors may break. Implement selector resilience with fallbacks and log warnings when primary selectors fail
2. **IP rate limiting** — Upwork may rate limit or block IPs that scrape too aggressively. Add delay between scrape retries. Consider exponential backoff
3. **JavaScript-rendered content** — Some Upwork pages require JS to load job data. `scraper` only parses static HTML. If jobs don't appear, Upwork may have moved to client-side rendering → fallback to manual paste
4. **CAPTCHA/bot detection** — Upwork may serve CAPTCHA pages. Detect by checking for CAPTCHA keywords in response body and return clear error
5. **Session cookies** — Some pages may require cookies. Start without cookies; only add if necessary
6. **Encoding issues** — Upwork pages are UTF-8 but may have encoding quirks. Handle with `reqwest`'s charset detection
7. **Composite error handling** — `AllImportMethodsFailed` must include BOTH error messages so user understands what happened

### Dependencies on Earlier Stories

**Hard Dependencies (MUST exist before implementing):**
- **4b-7 (RSS Feed Import):** This story modifies the RSS import command to add fallback. Core RSS infrastructure must exist
- **4b-7 error types:** `AppError::RssBlocked`, `AppError::RssFetchFailed` must be defined
- **job/mod.rs:** Job module structure must exist

**Soft Dependencies:**
- **4a-8 (Job Analysis Pipeline):** Scraped jobs go through same analysis pipeline as RSS jobs
- **4b-9 (Job Queue View):** After fallback import succeeds, jobs appear in queue

### Previous Story Intelligence

**Established patterns from 4b-7:**
- `JobInputSource` trait for input abstraction — add `WebScraperItem` impl
- Event emission via `app.emit()` using `Emitter` trait
- Background worker pattern for analysis queue
- Error handling with `AppError` enum variants
- `reqwest` HTTP client with timeouts

**Established patterns from Epics 0-3:**
- Tauri commands registered in `lib.rs`
- Frontend event listening with cleanup in `useEffect`
- Error display with inline messages (not modals)

### Project Structure Notes

**New files to create:**
- `src-tauri/src/job/scraper.rs` — Web scraper module

**Files to modify:**
- `src-tauri/Cargo.toml` — Add `scraper` dependency
- `src-tauri/src/job/mod.rs` — Add `mod scraper;`
- `src-tauri/src/job/rss.rs` — Modify `import_rss_feed` to use fallback orchestrator
- `src-tauri/src/errors.rs` — Add new error variants
- `src-tauri/src/events.rs` — Add fallback event constants
- `src/hooks/useRssImport.ts` — Listen for fallback events
- `src/components/RssImportProgress.tsx` — Show fallback status

### Test Fixtures

**Sample Upwork HTML fixture for tests:**
```html
<!DOCTYPE html>
<html>
<body>
  <section class="air3-card-section">
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01ABC123">
        <h2>React Developer Needed</h2>
      </a>
      <div class="job-description">
        <p>We need a skilled React developer for our dashboard project.</p>
      </div>
    </article>
    <article data-test="JobTile">
      <a class="job-title-link" href="/jobs/~01DEF456">
        <h2>TypeScript Expert</h2>
      </a>
      <div class="job-description">
        <p>Looking for TypeScript expertise for API development.</p>
      </div>
    </article>
  </section>
</body>
</html>
```

### References

- [Source: architecture.md#Job Input Source Abstraction] — `JobInputSource` trait, new impl for scraper
- [Source: architecture.md#Error Handling Hierarchy] — Composite error patterns
- [Source: architecture.md#Network Allowlisting] — Domain allowlist enforcement
- [Source: prd.md#Section 10.4 Risk 3] — Upwork blocks automation, mitigation includes fallback mechanisms
- [Source: epics.md#Round 4 Hindsight] — "RSS will break. Upwork hates automation." — original source of this requirement
- [Source: epics.md#Epic 4b Contingencies] — RSS fallback to web scraping listed as contingency
- [Source: epics-stories.md#4b.8] — Original story definition
- [Source: 4b-7-rss-feed-import.story.md] — Dependency story with RSS infrastructure

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
