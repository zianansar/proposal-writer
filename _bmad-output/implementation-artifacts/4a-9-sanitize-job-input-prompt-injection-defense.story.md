---
status: ready-for-dev
---

# Story 4a.9: Sanitize Job Input (Prompt Injection Defense)

## Story

As a system,
I want to prevent malicious job posts from injecting commands into AI prompts,
So that the app remains secure.

## Acceptance Criteria

**AC-1:** Given a user pastes job content, When the content is sent to the Claude API for analysis or generation, Then XML special characters in the job content are escaped before prompt construction (`<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`).

**AC-2:** Given job content is sanitized, Then it is wrapped in XML delimiters (`<job_post>...</job_post>`) per AR-13 before inclusion in the prompt.

**AC-3:** Given the job content exceeds 25,000 tokens (estimated via character heuristic), Then it is truncated at the last complete sentence boundary before the limit, and the user sees a warning: "Job post too long. Content was trimmed to fit analysis limits. Consider summarizing the post manually."

**AC-4:** Given the job content contains known prompt injection patterns (e.g., "Ignore previous instructions", "You are now", XML-style tags like `<system>` or `</system>`), Then these patterns are neutralized via escaping — not silently removed — so the original intent of legitimate text is preserved.

**AC-5:** Given the job content contains Unicode homoglyphs of XML characters (e.g., fullwidth `＜` U+FF1C), Then Unicode is normalized to NFC form before escaping, preventing homoglyph bypass attacks (per Round 6 security review).

**AC-6:** Given sanitization is applied, Then it adds <10ms to the analysis/generation pipeline (no measurable latency impact).

**AC-7:** Given the sanitization function is called, Then it works identically for both the analysis pipeline (`analyze_job_post`) and the generation pipeline (`generate_proposal_streaming`) — single shared function, not duplicated logic.

## Technical Notes

### Requirements Traceability

- **AR-13:** Prompt boundary enforcement with XML delimiters — job content in `user` role with explicit delimiters
- **AR-6:** Max 25K input tokens per generation
- **Round 5 Security Audit:** Prompt injection rated HIGH severity risk
- **Round 6 Rubber Duck:** Added Unicode normalization before tag stripping to prevent homoglyph attacks
- **OWASP LLM01:** Prompt Injection — directly mitigated by this story

### Architecture: New `sanitization.rs` Module

Create a dedicated sanitization module rather than embedding logic in `claude.rs` (already 668 lines) or `analysis.rs` (different concern).

```text
src-tauri/src/
├── sanitization.rs    ← NEW: input sanitization and prompt wrapping
├── claude.rs          ← calls sanitize_job_content() before prompt construction
├── analysis.rs        ← calls sanitize_job_content() before Haiku extraction
├── lib.rs             ← registers mod sanitization
└── ...
```

**Single entry point:** Both analysis and generation call `sanitize_job_content()` before constructing their prompts. This ensures no code path sends unsanitized content to the LLM.

### Delimiter Format Alignment

**Current state (claude.rs line 148):**

```rust
let user_message = format!(
    "[JOB_CONTENT_DELIMITER_START]\n{}\n[JOB_CONTENT_DELIMITER_END]\n\n...",
    job_content
);
```

**Architecture specifies XML delimiters.** This story aligns the code with AR-13:

```rust
let user_message = format!(
    "<job_post>\n{}\n</job_post>\n\n...",
    sanitized_content  // already escaped, safe to wrap in XML
);
```

Update both `claude.rs` (generation) and `analysis.rs` (analysis) to use `<job_post>` XML delimiters.

### Sanitization Pipeline

The `sanitize_job_content()` function applies transformations in order:

```text
raw_content
  → Step 1: Unicode NFC normalization (fullwidth chars → ASCII equivalents)
  → Step 2: XML character escaping (< > & → entities)
  → Step 3: Token count check (estimate via character heuristic)
  → Step 4: Truncate at sentence boundary if over limit
  → Result: { sanitized_content: String, was_truncated: bool }
```

**Why this order matters:**

1. Unicode normalization FIRST — ensures homoglyphs like `＜` become `<` before escaping
2. XML escaping SECOND — all `<`, `>`, `&` (including normalized ones) get escaped
3. Token check THIRD — count on the escaped content (entities are slightly longer than raw chars)
4. Truncation LAST — only if needed, preserves sentence boundaries

**Note on injection pattern stripping:** The original stub AC mentions "sanitizes attempts like 'Ignore previous instructions'." However, explicit pattern matching for injection phrases is fragile (endless patterns, false positives on legitimate text like "Please ignore previous instructions from the old project spec"). XML escaping + delimiter wrapping (AC-1, AC-2) is the robust defense — it prevents the content from being interpreted as instructions regardless of what it says. Injection phrase detection is NOT implemented as a blocklist; the escaping approach is the defense.

### Token Estimation Heuristic

For MVP, use a character-based approximation rather than adding a tokenizer dependency:

- **Heuristic:** 1 token ≈ 4 characters (English text average for Claude's tokenizer)
- **25K tokens ≈ 100,000 characters**
- This is conservative — most job posts are 500-3,000 characters (well under limit)
- A real tokenizer (e.g., `tiktoken-rs`) can be added later if precision matters

```rust
const MAX_INPUT_CHARS: usize = 100_000; // ~25K tokens at 4 chars/token

pub fn estimate_tokens(text: &str) -> usize {
    text.len() / 4
}
```

### Sentence Boundary Truncation

When content exceeds the limit, truncate at the last complete sentence before the boundary:

```rust
fn truncate_at_sentence_boundary(content: &str, max_chars: usize) -> &str {
    if content.len() <= max_chars {
        return content;
    }
    // Find last ". " before max_chars
    let search_slice = &content[..max_chars];
    match search_slice.rfind(". ") {
        Some(pos) => &content[..=pos],  // include the period
        None => &content[..max_chars],  // no sentence boundary found, hard cut
    }
}
```

**Edge cases for sentence detection:**

- Abbreviations ("Dr. Smith") — accepted as false positives; minor content loss is acceptable vs. mid-sentence cut
- No periods in text — fall back to hard character cut
- Very short sentences after cut — acceptable; user is warned about truncation

### Sanitization Return Type

```rust
pub struct SanitizationResult {
    pub content: String,        // sanitized, escaped content (NOT wrapped in delimiters)
    pub was_truncated: bool,    // true if content exceeded token limit
    pub original_length: usize, // original character count for logging
}
```

The caller (claude.rs or analysis.rs) wraps the sanitized content in `<job_post>...</job_post>` delimiters when constructing the prompt. The sanitization function does NOT add delimiters — separation of concerns.

## Tasks / Subtasks

- [ ] Task 1: Create `sanitization.rs` module (AC: 1, 4, 5, 6)
  - [ ] 1.1: Create `src-tauri/src/sanitization.rs` with `sanitize_job_content(raw_content: &str) -> SanitizationResult`
  - [ ] 1.2: Implement Unicode NFC normalization using `unicode-normalization` crate (add to Cargo.toml)
  - [ ] 1.3: Implement XML character escaping: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;` (process `&` first to avoid double-escaping)
  - [ ] 1.4: Implement token estimation via character heuristic (100K chars ≈ 25K tokens)
  - [ ] 1.5: Implement sentence boundary truncation (`rfind(". ")` before limit)
  - [ ] 1.6: Return `SanitizationResult { content, was_truncated, original_length }`
  - [ ] 1.7: Register `mod sanitization;` in `lib.rs`

- [ ] Task 2: Integrate sanitization into analysis pipeline (AC: 2, 7)
  - [ ] 2.1: In `analysis.rs` (`analyze_job_post` function): call `sanitize_job_content()` on raw job content before constructing the Haiku prompt
  - [ ] 2.2: Wrap sanitized content in `<job_post>...</job_post>` XML delimiters in the user message
  - [ ] 2.3: If `was_truncated`, include truncation flag in return value so frontend can show warning

- [ ] Task 3: Integrate sanitization into generation pipeline (AC: 2, 7)
  - [ ] 3.1: In `claude.rs` (`generate_proposal_streaming`): call `sanitize_job_content()` on job content before constructing the generation prompt
  - [ ] 3.2: Replace bracket delimiters `[JOB_CONTENT_DELIMITER_START/END]` with XML `<job_post>...</job_post>` (align with AR-13)
  - [ ] 3.3: If `was_truncated`, log warning via existing logging infrastructure (Story 1-16)

- [ ] Task 4: Add truncation warning to frontend (AC: 3)
  - [ ] 4.1: Extend `JobAnalysis` return type (or analysis response) to include `was_truncated: bool`
  - [ ] 4.2: In App.tsx: if `was_truncated` is true after analysis, show inline warning message below the analysis area
  - [ ] 4.3: Warning text: "Job post too long. Content was trimmed to fit analysis limits. Consider summarizing the post manually."
  - [ ] 4.4: Style as a muted warning (not blocking, not modal) — amber/yellow text or subtle banner

- [ ] Task 5: Write tests (AC: All)
  - [ ] 5.1: Rust unit test: XML escaping — `<script>` becomes `&lt;script&gt;`
  - [ ] 5.2: Rust unit test: `&` escaped to `&amp;` (must not double-escape `&lt;` to `&amp;lt;`)
  - [ ] 5.3: Rust unit test: Unicode fullwidth `＜` (U+FF1C) normalized then escaped to `&lt;`
  - [ ] 5.4: Rust unit test: content under 100K chars passes through without truncation (`was_truncated: false`)
  - [ ] 5.5: Rust unit test: content over 100K chars truncated at sentence boundary (`was_truncated: true`)
  - [ ] 5.6: Rust unit test: truncation preserves complete sentences (ends at ". ")
  - [ ] 5.7: Rust unit test: content with no periods truncated at hard character limit
  - [ ] 5.8: Rust unit test: injection pattern "Ignore previous instructions" is escaped (angle brackets around it neutralized), not silently removed
  - [ ] 5.9: Rust unit test: `<system>` tag in job content becomes `&lt;system&gt;` after sanitization
  - [ ] 5.10: Rust unit test: empty string input returns empty string, no crash
  - [ ] 5.11: Rust unit test: normal job post content passes through with only `&` escaping (no false positives)
  - [ ] 5.12: Rust benchmark: sanitization of 100K character input completes in <10ms
  - [ ] 5.13: Frontend test: truncation warning appears when `was_truncated` is true
  - [ ] 5.14: Frontend test: no warning shown when `was_truncated` is false

## Dev Notes

### Dependencies

- **Story 4a-2 (HARD DEPENDENCY):** Creates `analysis.rs` and `analyze_job_post` — 4a-9 integrates sanitization into this pipeline
- **Story 0-2 (HARD DEPENDENCY):** `claude.rs` `generate_proposal_streaming` — 4a-9 integrates sanitization into generation pipeline and updates delimiters
- **Crate dependency:** `unicode-normalization` for NFC normalization (add to `Cargo.toml`)

### Existing Code References

| File | What's There | What to Change |
| :--- | :--- | :--- |
| `src-tauri/src/claude.rs` (line 146-150) | Bracket delimiters `[JOB_CONTENT_DELIMITER_START/END]`, no sanitization | Add `sanitize_job_content()` call, replace with XML `<job_post>` delimiters |
| `src-tauri/src/analysis.rs` | `analyze_job_post()` takes raw content | Add `sanitize_job_content()` call before prompt construction |
| `src-tauri/src/lib.rs` | Module registrations | Add `mod sanitization;` |
| `src-tauri/Cargo.toml` | Dependencies | Add `unicode-normalization` crate |
| `src/App.tsx` | Analysis state and display | Add truncation warning display |

### Edge Cases

- **Normal job posts (99% case):** 500-3,000 characters, no special chars. Sanitization is a no-op except for any `&` characters. Passes through quickly.
- **Job post with HTML/markdown:** Common — posts may contain `<br>`, `<strong>`, markdown links. These get escaped harmlessly (`&lt;br&gt;`). LLM still understands the content.
- **Extremely long paste (>100K chars):** Truncated with warning. Sentence boundary preserved. User informed.
- **Empty input:** Returns empty string, `was_truncated: false`. No crash.
- **Non-English text:** Unicode normalization handles CJK, Cyrillic, Arabic. XML escaping only affects `<`, `>`, `&` which are ASCII. No impact on non-English content.
- **Legitimate use of "Ignore previous" in job post:** e.g., "Please ignore previous freelancer's work and start fresh." This is NOT stripped — it passes through as escaped text. The XML delimiter boundary is the defense, not content filtering.
- **Double-escaping risk:** `&` must be escaped FIRST (before `<` and `>`), so `&lt;` in original text becomes `&amp;lt;` (correct), not `&lt;` → `&amp;lt;` (also correct if order is right). Test 5.2 covers this.

### Design Decision: Escaping Over Stripping

The original stub AC mentions "Sanitizes attempts like 'Ignore previous instructions'." This story uses **escaping** rather than **content stripping** as the defense:

- **Stripping** (blocklist approach): Fragile, endless patterns, false positives, arms race with attackers
- **Escaping** (boundary enforcement): Robust, prevents ALL content from being interpreted as instructions regardless of what it says

XML escaping + delimiter wrapping makes the job content inert within the prompt structure. Even if the content says "Ignore previous instructions," it's treated as quoted text inside `<job_post>` tags, not as a directive.

### Scope Boundaries

**In scope:**

- `sanitization.rs` module with `sanitize_job_content()`
- Unicode NFC normalization
- XML character escaping (`<`, `>`, `&`)
- Token estimation and sentence-boundary truncation
- Integration into both analysis and generation pipelines
- Delimiter alignment with AR-13 (`<job_post>` XML tags)
- Truncation warning in frontend

**Out of scope:**

- Injection phrase blocklist (escaping is the defense, not pattern matching)
- Exact token counting via tokenizer crate (heuristic is sufficient for MVP)
- Output sanitization (handled by Stories 3-1/3-2 pre-flight safety)
- Rate limiting (Story 3-8)
- Content moderation / NSFW filtering (not in PRD scope)

### NFR Targets

| NFR | Target | Validation |
| :--- | :--- | :--- |
| Sanitization speed | <10ms for 100K chars | Benchmark test |
| Latency impact | Undetectable in pipeline | No additional API calls, string ops only |
| False positive rate | 0% for normal job posts | Normal text passes through with only `&` escaping |

### References

- [AR-13: architecture.md — Prompt boundary enforcement with XML delimiters]
- [AR-6: architecture.md — Max 25K input tokens]
- [Round 5 Security Audit: Prompt injection HIGH severity]
- [Round 6 Rubber Duck: Unicode normalization before tag stripping]
- [OWASP LLM01: Prompt Injection mitigation]
- [Pattern: claude.rs line 146-150 — current delimiter implementation]
- [Story 4a-2: analysis.rs pipeline (consumer)]
- [Story 0-2: claude.rs generation pipeline (consumer)]
