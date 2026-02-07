---
status: ready-for-dev
---

# Story 4a.2: Client Name Extraction

## Story

As a freelancer,
I want the app to automatically identify the client's name from the job post,
So that I can personalize my proposal.

## Acceptance Criteria

**AC-1:** Given I've pasted a job post, When I click "Analyze Job", Then the system calls Claude Haiku to extract the client name from the raw content.

**AC-2:** Given the analysis completes successfully, Then the UI displays "Client: John Smith" (or "Client: Unknown" if no name found) below the job input area.

**AC-3:** Given the analysis extracts a client name, Then the `client_name` column in the `job_posts` table is updated with the extracted value.

**AC-4:** Given the analysis call, Then it completes in <3 seconds (NFR target for Haiku analysis).

**AC-5:** Given the API call fails (network error, rate limit, etc.), Then the UI shows an inline error message and does not block other app functionality.

## Technical Notes

### Requirements Traceability

- **FR-2:** System extracts "Client Name", "Key Skills", and "Hidden Needs" — this story covers Client Name only
- **AR-4:** LLM provider: Anthropic Claude — Haiku 4.5 for analysis (cost-effective)
- **AR-5:** Prompt caching enabled for system prompts and few-shot examples (50-70% input token savings)

### Architecture Context

The existing `claude.rs` already has both model constants:
- `claude-sonnet-4-20250514` (generation)
- `claude-haiku-4-20250514` (analysis) — used by `analyze_perplexity_with_sentences()`

Follow the same pattern as `analyze_perplexity_with_sentences()` in `claude.rs` for making Haiku API calls. That function demonstrates:
- API key retrieval from keychain
- Non-streaming Haiku call with JSON response parsing
- Error handling and timeout patterns

### Prompt Design

Use structured JSON output. System prompt + few-shot examples should use Anthropic prompt caching (`cache_control: { type: "ephemeral" }` on stable content blocks) per AR-5.

**System prompt guidance:**
- Extract the client's name (person or company) from the job post
- Return JSON: `{ "client_name": "John Smith" }` or `{ "client_name": null }`
- Look for: greeting signatures ("Hi, I'm..."), company names, profile references, sign-offs
- If ambiguous between multiple names, prefer the hiring person over company name
- If no name found at all, return `null`

**Few-shot examples (3-4 covering common patterns):**
1. Job post with explicit name in greeting → extracts name
2. Job post with company name only → extracts company name
3. Job post with no identifiable name → returns null
4. Job post with name in sign-off → extracts name

### Database

- `job_posts` table already has `client_name TEXT` column (V3 migration) — currently always `NULL`
- `insert_job_post(url, raw_content, client_name)` in `job_posts.rs` already accepts client_name
- Need: `update_job_post_client_name(id: i64, client_name: Option<&str>)` query function
- The `save_job_post` Tauri command in `lib.rs` currently hardcodes `client_name: None` — update to accept extracted value

### Extensibility Note

Stories 4a-3 (Key Skills) and 4a-4 (Hidden Needs) will add more extraction fields. Design the `JobAnalysis` result struct to be extensible:
```rust
pub struct JobAnalysis {
    pub client_name: Option<String>,
    // 4a-3 will add: pub key_skills: Vec<String>,
    // 4a-4 will add: pub hidden_needs: Vec<HiddenNeed>,  // HiddenNeed = { need, evidence }
}
```
Use a single `analyze_job_post` Rust module/function that can grow. When 4a-3 lands, the prompt and struct expand — no rewrite needed.

## Tasks / Subtasks

- [ ] Task 1: Create job analysis module in Rust backend (AC: 1, 4)
  - [ ] 1.1: Create `src-tauri/src/analysis.rs` module with `JobAnalysis` struct (`client_name: Option<String>`)
  - [ ] 1.2: Implement `extract_client_name(raw_content: &str, api_key: &str) -> Result<JobAnalysis, String>` function
  - [ ] 1.3: Build system prompt with few-shot examples for client name extraction (see Prompt Design section)
  - [ ] 1.4: Add `cache_control: { "type": "ephemeral" }` to system prompt content block for prompt caching (AR-5). Add `anthropic-beta: prompt-caching-2024-07-31` header to request
  - [ ] 1.5: Call Claude Haiku (`claude-haiku-4-20250514`) via non-streaming API (follow `analyze_perplexity_with_sentences` pattern)
  - [ ] 1.6: Parse JSON response, extract `client_name` field, handle malformed responses gracefully
  - [ ] 1.7: Register `mod analysis;` in `lib.rs`

- [ ] Task 2: Create Tauri command for job analysis (AC: 1, 3, 5)
  - [ ] 2.1: Add `analyze_job_post(raw_content: String)` Tauri command in `lib.rs`
  - [ ] 2.2: Retrieve API key from keychain (follow existing pattern in `generate_proposal_streaming`)
  - [ ] 2.3: Call `extract_client_name()` from `analysis.rs`
  - [ ] 2.4: On success: save/update `client_name` in `job_posts` table (insert new record or update existing via job_post_id)
  - [ ] 2.5: Return `JobAnalysis` result (serialized) to frontend
  - [ ] 2.6: On API failure: return descriptive error string (do not panic)
  - [ ] 2.7: Register command in `invoke_handler`

- [ ] Task 3: Add database query for updating client_name (AC: 3)
  - [ ] 3.1: Add `update_job_post_client_name(conn, id: i64, client_name: Option<&str>) -> Result<()>` to `db/queries/job_posts.rs`
  - [ ] 3.2: SQL: `UPDATE job_posts SET client_name = ?1 WHERE id = ?2`

- [ ] Task 4: Add "Analyze Job" button to frontend (AC: 1, 2, 5)
  - [ ] 4.1: Create `AnalyzeButton.tsx` component — styled consistently with existing `GenerateButton.tsx` (secondary/outline variant to visually distinguish from primary Generate action)
  - [ ] 4.2: Button disabled when job input is empty or analysis is in-progress
  - [ ] 4.3: Place button in `App.tsx` between JobInput and GenerateButton areas
  - [ ] 4.4: On click: invoke `analyze_job_post` Tauri command with current `jobContent`
  - [ ] 4.5: Show inline loading indicator on button during API call ("Analyzing...")
  - [ ] 4.6: On success: store `clientName` in component state; on error: store error message

- [ ] Task 5: Display extracted client name (AC: 2)
  - [ ] 5.1: Add `ClientNameDisplay` inline element below the Analyze button or in a small results strip
  - [ ] 5.2: Show "Client: {name}" when extracted, "Client: Unknown" when `null`, nothing before analysis runs
  - [ ] 5.3: Style with subtle text matching existing theme patterns (see `App.css` variables)
  - [ ] 5.4: Keep it minimal — Story 4a-7 will build the comprehensive results display

- [ ] Task 6: Write tests (AC: All)
  - [ ] 6.1: Rust unit test: `extract_client_name` with mocked API response containing a name → returns `Some("John Smith")`
  - [ ] 6.2: Rust unit test: `extract_client_name` with mocked response where name is null → returns `None`
  - [ ] 6.3: Rust unit test: `extract_client_name` with malformed JSON response → returns descriptive error
  - [ ] 6.4: Rust unit test: `update_job_post_client_name` updates the correct record
  - [ ] 6.5: Frontend test: AnalyzeButton renders and is disabled when input is empty
  - [ ] 6.6: Frontend test: AnalyzeButton is enabled when job content is present
  - [ ] 6.7: Frontend test: ClientNameDisplay shows "Client: Unknown" for null result
  - [ ] 6.8: Frontend test: ClientNameDisplay shows "Client: John Smith" for extracted name
  - [ ] 6.9: Frontend test: error state displays inline error message (not modal)

## Dev Notes

### Dependencies

- **Story 4a-1** (Job Post Input with URL or Text Detection) should ideally be complete first, as it enhances the input flow. However, 4a-2 can be implemented independently — the existing `JobInput` component already captures `jobContent` and `job_posts` table already exists.
- **API key must be configured** — analysis requires a valid Anthropic API key in the OS keychain (Story 2.6, already done).

### Existing Code References

| File | What's There | What to Change |
|:-----|:-------------|:---------------|
| `src-tauri/src/claude.rs` | Haiku model constant (line 12), `analyze_perplexity_with_sentences()` pattern (line 615+) | Reference pattern only — add analysis logic in new `analysis.rs` module |
| `src-tauri/src/lib.rs` | `save_job_post` command (line 243), command registration | Add `analyze_job_post` command, register it |
| `src-tauri/src/db/queries/job_posts.rs` | `insert_job_post(url, raw_content, client_name)` | Add `update_job_post_client_name()` |
| `src-tauri/migrations/V3__add_job_posts_table.sql` | `client_name TEXT` column already exists | No change needed |
| `src/App.tsx` | Main app flow, perplexity auto-analysis pattern | Add AnalyzeButton, wire up command invocation |
| `src/components/GenerateButton.tsx` | Button styling pattern | Reference for AnalyzeButton styling |
| `src/components/JobInput.tsx` | Job content textarea | No change — reads existing `jobContent` state |

### Edge Cases

- **No client name in post:** Many Upwork posts don't include a name → return `null`, display "Unknown"
- **Company name vs person:** Prompt should prefer hiring person's name over company; if only company visible, use company name
- **Very short posts (< 20 words):** Still attempt extraction — may legitimately contain a name
- **Non-English posts:** Haiku handles multilingual — no special handling needed
- **HTML/markdown in content:** Job posts may contain formatting — prompt should handle raw text
- **Repeated analysis:** User clicks "Analyze" multiple times — should update (not duplicate) the stored client_name

### Scope Boundaries

**In scope:**
- Rust extraction function with Claude Haiku call
- Prompt caching setup (AR-5) for analysis system prompt
- "Analyze Job" button (minimal — loading state enhancement is 4a-6)
- Inline client name display (minimal — comprehensive display is 4a-7)
- Save extracted client_name to existing DB column

**Out of scope:**
- Key skills extraction (Story 4a-3)
- Hidden needs detection (Story 4a-4)
- Comprehensive loading/progress UI (Story 4a-6)
- Full analysis results panel (Story 4a-7)
- Comprehensive analysis save with all fields (Story 4a-8)
- Input sanitization (Story 4a-9)
- URL fetching/scraping (future enhancement)

### NFR Targets

| NFR | Target | Validation |
|:----|:-------|:-----------|
| Analysis speed | <3 seconds | Measure round-trip from button click to display |
| Prompt caching | 50-70% token savings on repeat calls | Verify `cache_creation_input_tokens` vs `cache_read_input_tokens` in API response |

### References

- [FR-2: prd.md Section 4.2 — Job Analysis & Queue]
- [AR-4: architecture.md — LLM Integration Decision]
- [AR-5: architecture.md — Prompt caching]
- [Pattern: claude.rs `analyze_perplexity_with_sentences()` — Haiku analysis call]
- [Anthropic Prompt Caching Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
