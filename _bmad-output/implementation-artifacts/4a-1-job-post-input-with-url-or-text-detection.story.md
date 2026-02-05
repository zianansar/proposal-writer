---
status: ready-for-dev
---

# Story 4a.1: Job Post Input with URL or Text Detection

## Story

As a freelancer,
I want to paste either a job URL or raw job text,
So that I have flexibility in how I provide job information.

## Acceptance Criteria

**Given** I'm on the job input screen
**When** I paste content into the input field
**Then** the system detects if it's a URL (starts with http/https) or raw text
**And** if URL, shows indicator: "Job URL detected"
**And** if text, shows indicator: "Raw job text detected"
**And** both are accepted and saved to job_posts table

**Given** the input field is empty
**When** no content has been entered
**Then** no indicator is shown

**Given** I paste a URL into the input field
**When** the system saves the job post
**Then** the URL is extracted and saved to the `url` column
**And** the full content is saved to `raw_content`

## Tasks / Subtasks

- [ ] Task 1: Add URL detection utility (AC: 1)
  - [ ] 1.1: Create `detectInputType(content: string)` function returning `{ type: "url" | "text" | null, url: string | null }`
  - [ ] 1.2: Detection logic: trim whitespace, check if entire content starts with `http://` or `https://` and contains no newlines (single URL vs text block with embedded URL)
  - [ ] 1.3: Place in `JobInput.tsx` as a module-level function (no separate file needed for one utility)

- [ ] Task 2: Add visual indicator to JobInput component (AC: 1, 2, 3)
  - [ ] 2.1: Add state: `inputType: "url" | "text" | null` derived from content via `detectInputType`
  - [ ] 2.2: Update `handleChange` to call `detectInputType` on each change
  - [ ] 2.3: Render indicator below textarea: "Job URL detected" (with link icon context) or "Raw job text detected"
  - [ ] 2.4: No indicator shown when input is empty (`null` type)
  - [ ] 2.5: Style indicator with subtle text matching dark/light theme (use existing CSS patterns from App.css)

- [ ] Task 3: Propagate detected input type to parent (AC: 1)
  - [ ] 3.1: Extend `JobInputProps` with `onInputTypeChange?: (type: "url" | "text" | null, detectedUrl: string | null) => void`
  - [ ] 3.2: Call `onInputTypeChange` alongside `onJobContentChange` when content changes
  - [ ] 3.3: Update App.tsx to track `detectedUrl` state from JobInput callback

- [ ] Task 4: Update save flow to pass detected URL (AC: 1)
  - [ ] 4.1: In App.tsx `handleSaveForLater()`, pass `detectedUrl` instead of hardcoded `null` to `save_job_post`
  - [ ] 4.2: In App.tsx `handleGenerate()` flow, pass `detectedUrl` when saving job post (if save occurs during generation)

- [ ] Task 5: Write tests (AC: All)
  - [ ] 5.1: Unit test `detectInputType`: URL with `https://` returns `{ type: "url", url: "https://..." }`
  - [ ] 5.2: Unit test `detectInputType`: URL with `http://` returns url type
  - [ ] 5.3: Unit test `detectInputType`: plain text returns `{ type: "text", url: null }`
  - [ ] 5.4: Unit test `detectInputType`: empty string returns `{ type: null, url: null }`
  - [ ] 5.5: Unit test `detectInputType`: text block containing a URL mid-text returns `text` type (not url)
  - [ ] 5.6: Unit test `detectInputType`: URL with leading/trailing whitespace still detected as URL
  - [ ] 5.7: Component test: no indicator shown when input is empty
  - [ ] 5.8: Component test: "Job URL detected" shown when URL is pasted
  - [ ] 5.9: Component test: "Raw job text detected" shown when text is pasted
  - [ ] 5.10: Component test: `onInputTypeChange` callback fires with correct type

## Dev Notes

### Architecture Context

- **FR-1:** User can paste a Raw Job Post URL or text content
- **Architecture vision:** `job/parser.rs` with `JobInputSource` trait is the eventual target. This story is frontend-only detection — no Rust parser changes needed yet
- **No URL fetching:** URL detection is purely visual indicator + metadata storage. Actual URL scraping is a future enhancement
- **Database ready:** `job_posts` table already has nullable `url` column and `raw_content` — no migration needed

### Existing Code References

- **JobInput.tsx** (`upwork-researcher/src/components/JobInput.tsx`): Current component — simple textarea with `value`/`onChange`, no detection
- **JobInput.test.tsx** (`upwork-researcher/src/components/JobInput.test.tsx`): 5 existing tests — extend, don't replace
- **job_posts.rs** (`upwork-researcher/src-tauri/src/db/queries/job_posts.rs`): `insert_job_post(url: Option<&str>, raw_content, client_name)` — already supports URL
- **lib.rs:243** (`upwork-researcher/src-tauri/src/lib.rs`): `save_job_post` Tauri command — already accepts `url: Option<String>`
- **App.tsx:314-316** (`upwork-researcher/src/App.tsx`): Currently hardcodes `url: null` — needs update to pass detected URL

### Edge Cases

- **Multi-line content starting with URL:** Treat as text (user pasted job description with URL at top)
- **URL with trailing whitespace/newline:** Trim before detection, still treat as URL if single-line
- **Empty input:** No indicator, `null` type
- **Very long URL:** Still valid — no length limit on detection
