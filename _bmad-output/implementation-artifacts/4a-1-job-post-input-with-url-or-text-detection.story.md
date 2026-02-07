---
status: done
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

- [x] Task 1: Add URL detection utility (AC: 1)
  - [x] 1.1: Create `detectInputType(content: string)` function returning `{ type: "url" | "text" | null, url: string | null }`
  - [x] 1.2: Detection logic: trim whitespace, check if entire content starts with `http://` or `https://` and contains no newlines (single URL vs text block with embedded URL)
  - [x] 1.3: Place in `JobInput.tsx` as a module-level function (no separate file needed for one utility)

- [x] Task 2: Add visual indicator to JobInput component (AC: 1, 2, 3)
  - [x] 2.1: Add state: `inputType: "url" | "text" | null` derived from content via `detectInputType`
  - [x] 2.2: Update `handleChange` to call `detectInputType` on each change
  - [x] 2.3: Render indicator below textarea: "Job URL detected" (with link icon context) or "Raw job text detected"
  - [x] 2.4: No indicator shown when input is empty (`null` type)
  - [x] 2.5: Style indicator with subtle text matching dark/light theme (use existing CSS patterns from App.css)

- [x] Task 3: Propagate detected input type to parent (AC: 1)
  - [x] 3.1: Extend `JobInputProps` with `onInputTypeChange?: (type: "url" | "text" | null, detectedUrl: string | null) => void`
  - [x] 3.2: Call `onInputTypeChange` alongside `onJobContentChange` when content changes
  - [x] 3.3: Update App.tsx to track `detectedUrl` state from JobInput callback

- [x] Task 4: Update save flow to pass detected URL (AC: 1)
  - [x] 4.1: In App.tsx `handleSaveForLater()`, pass `detectedUrl` instead of hardcoded `null` to `save_job_post`
  - [N/A] 4.2: In App.tsx `handleGenerate()` flow, pass `detectedUrl` when saving job post — N/A: proposal save flow uses `save_proposal` not `save_job_post`

- [x] Task 5: Write tests (AC: All)
  - [x] 5.1: Unit test `detectInputType`: URL with `https://` returns `{ type: "url", url: "https://..." }`
  - [x] 5.2: Unit test `detectInputType`: URL with `http://` returns url type
  - [x] 5.3: Unit test `detectInputType`: plain text returns `{ type: "text", url: null }`
  - [x] 5.4: Unit test `detectInputType`: empty string returns `{ type: null, url: null }`
  - [x] 5.5: Unit test `detectInputType`: text block containing a URL mid-text returns `text` type (not url)
  - [x] 5.6: Unit test `detectInputType`: URL with leading/trailing whitespace still detected as URL
  - [x] 5.7: Component test: no indicator shown when input is empty
  - [x] 5.8: Component test: "Job URL detected" shown when URL is pasted
  - [x] 5.9: Component test: "Raw job text detected" shown when text is pasted
  - [x] 5.10: Component test: `onInputTypeChange` callback fires with correct type

## Review Follow-ups (AI)

- [x] [AI-Review][M1] Fixed: useEffect missing dependencies — added `jobContent`, `onInputTypeChange` to deps array [JobInput.tsx:51]
- [x] [AI-Review][M2] Fixed: Task 4.2 marked [x] but was N/A — updated task status to [N/A] with explanation
- [x] [AI-Review][M3] Fixed: Accessibility — added `role="status"` and `aria-live="polite"` to input type indicators [JobInput.tsx:74-83]
- [ ] [AI-Review][L1] Dead parameter `_type` in `handleInputTypeChange` callback — consider using or removing [App.tsx:592]
- [x] [AI-Review][L2] Fixed: Added test for controlled value sync (draft recovery scenario) [JobInput.test.tsx]
- [x] [AI-Review][L3] Fixed: Tests now verify exact emoji text "🔗 Job URL detected" and "📝 Raw job text detected" [JobInput.test.tsx]

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

## Dev Agent Record

### Implementation Plan

Frontend-only URL detection with visual feedback and parent state propagation.

### Completion Notes

**Implemented:**
1. `detectInputType()` utility function in JobInput.tsx - detects URL vs text vs empty
2. Visual indicator below textarea showing "🔗 Job URL detected" or "📝 Raw job text detected"
3. `onInputTypeChange` callback prop to propagate detection to parent
4. `detectedUrl` state in App.tsx tracked via callback
5. `handleSaveForLater()` now passes detected URL to `save_job_post` command

**Tests Added (21 total, 15 new):**
- 9 unit tests for `detectInputType()` function
- 6 component tests for visual indicators and callbacks

**Notes:**
- Task 4.2 (pass detectedUrl during generation) is N/A - proposal save flow uses `jobContentRef` and doesn't call `save_job_post` directly
- Used emoji icons (🔗 📝) for visual clarity in indicators
- CSS supports both dark and light themes

## File List

- `upwork-researcher/src/components/JobInput.tsx` (modified)
- `upwork-researcher/src/components/JobInput.test.tsx` (modified)
- `upwork-researcher/src/App.tsx` (modified)
- `upwork-researcher/src/App.css` (modified)

## Change Log

- 2026-02-07: Story 4a.1 implementation complete. Added URL/text detection with visual indicators and parent state propagation. 21 tests passing.
- 2026-02-07: Code review fixes — React hook deps, accessibility (role/aria-live), test coverage for controlled mode, emoji assertions. 23 tests now.
