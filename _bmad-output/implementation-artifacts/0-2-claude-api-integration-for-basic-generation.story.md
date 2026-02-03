---
status: in-progress
assignedTo: "dev-agent"
tasksCompleted: 6
totalTasks: 7
testsWritten: true
fileList:
  - upwork-researcher/src/App.tsx
  - upwork-researcher/src/App.css
  - upwork-researcher/src/App.test.tsx
  - upwork-researcher/src/components/GenerateButton.tsx
  - upwork-researcher/src/components/GenerateButton.test.tsx
  - upwork-researcher/src/components/ProposalOutput.tsx
  - upwork-researcher/src/components/ProposalOutput.test.tsx
  - upwork-researcher/src-tauri/Cargo.toml
  - upwork-researcher/src-tauri/src/lib.rs
  - upwork-researcher/src-tauri/src/claude.rs
---

# Story 0.2: Claude API Integration for Basic Generation

## Story

As a freelancer,
I want the app to generate a proposal draft using AI,
So that I don't have to write from scratch.

## Acceptance Criteria

**AC-1:** Given I have pasted job content in the input, When I click "Generate Proposal", Then the system calls Claude Sonnet 4.5 API with the job content.

**AC-2:** Given the API call succeeds, Then I receive a 3-paragraph proposal (Hook, Bridge, CTA).

**AC-3:** Given the proposal is generated, Then it displays the generated text in a simple output area.

**AC-4:** Given generation starts, Then full generation completes in <8 seconds (NFR-6).

## Tasks/Subtasks

- [x] Task 1: Add "Generate Proposal" button to UI (AC: 1)
  - [x] Subtask 1.1: Create GenerateButton component with onClick handler
  - [x] Subtask 1.2: Add button styling consistent with app design
  - [x] Subtask 1.3: Wire button to App state for triggering generation
- [x] Task 2: Create ProposalOutput component for displaying result (AC: 3)
  - [x] Subtask 2.1: Create ProposalOutput component with text display area
  - [x] Subtask 2.2: Add loading state indicator while generating
  - [x] Subtask 2.3: Add error state display for API failures
  - [x] Subtask 2.4: Style output area for readability
- [x] Task 3: Add Anthropic SDK to Rust backend (AC: 1)
  - [x] Subtask 3.1: Add `reqwest` crate for HTTP client
  - [x] Subtask 3.2: Create Claude API module in `src-tauri/src/claude.rs`
  - [x] Subtask 3.3: Implement generate_proposal function with env var API key
  - [x] Subtask 3.4: Create prompt template for 3-paragraph proposal (Hook, Bridge, CTA)
- [x] Task 4: Create Tauri command for generation (AC: 1, 2)
  - [x] Subtask 4.1: Define `generate_proposal` Tauri command in lib.rs
  - [x] Subtask 4.2: Accept job_content string parameter
  - [x] Subtask 4.3: Return generated proposal string or error
  - [x] Subtask 4.4: Implement prompt boundary enforcement (job content in user role with delimiters)
- [x] Task 5: Wire frontend to Tauri command (AC: 1, 2, 3)
  - [x] Subtask 5.1: Import `invoke` from `@tauri-apps/api/core`
  - [x] Subtask 5.2: Create `handleGenerate` async function in App
  - [x] Subtask 5.3: Connect button click → invoke → display result
  - [x] Subtask 5.4: Handle loading/error states
- [x] Task 6: Write unit and integration tests (AC: all)
  - [x] Subtask 6.1: Test GenerateButton renders and fires onClick (6 tests)
  - [x] Subtask 6.2: Test ProposalOutput displays text, loading, error states (7 tests)
  - [x] Subtask 6.3: Test App integration with mock Tauri invoke (10 tests)
- [ ] Task 7: Verify performance requirement (AC: 4)
  - [ ] Subtask 7.1: Measure generation time end-to-end
  - [ ] Subtask 7.2: Document timing in completion notes

### Review Follow-ups (AI)
- [ ] [AI-Review][High] Complete Task 7 or update tasksCompleted count — AC-4 (<8s) is untested — REQUIRES API KEY
- [x] [AI-Review][Med] Consider reusing reqwest::Client for connection pooling [claude.rs:55] — DEFERRED to 0.3 (acceptable for spike)
- [x] [AI-Review][Med] Reduce tokio features from "full" to minimal required [Cargo.toml:26] — FIXED: now "rt" only
- [x] [AI-Review][Med] Note: CSP needs connect-src if future stories add frontend fetch — NOTED for Epic 2
- [x] [AI-Review][Low] Model ID hardcoded — make configurable in Epic 10 [claude.rs:8] — DEFERRED
- [x] [AI-Review][Low] Add aria-live to ProposalOutput for accessibility [ProposalOutput.tsx] — FIXED

## Dev Notes

### Architecture Requirements

- **LLM Provider:** Anthropic Claude via direct HTTP (no official Rust SDK — use `reqwest`)
- **Model:** Claude Sonnet 4.5 (`claude-sonnet-4-5-20241022` or latest)
- **API Endpoint:** `https://api.anthropic.com/v1/messages`
- **Headers Required:**
  - `x-api-key: <API_KEY>`
  - `anthropic-version: 2023-06-01`
  - `content-type: application/json`
- **No streaming in this story** — get full response, then display (streaming is Story 0.3)
- **Hardcoded API key for spike** — will move to OS Keychain in Epic 2

### Prompt Template

```
System: You are an expert Upwork proposal writer. Generate a 3-paragraph proposal:
1. Hook: Open with a specific insight about the client's problem that shows you read the job post
2. Bridge: Explain your relevant experience and approach to solving their problem
3. CTA: End with a clear call to action and availability

Keep the total length under 200 words. Write in a professional but conversational tone.

User: [JOB_CONTENT_DELIMITER_START]
{job_content}
[JOB_CONTENT_DELIMITER_END]

Generate a proposal for this job:
```

### Prompt Boundary Enforcement (Security)

Per architecture.md Red Team analysis:
- Job content MUST be placed in `user` role with explicit delimiters
- System prompt MUST NOT contain user-supplied text
- This prevents prompt injection via malicious job postings

### CSP Consideration

Current CSP: `default-src 'self'; style-src 'self' 'unsafe-inline'`

For API calls from Rust backend, CSP doesn't apply (Rust HTTP calls bypass webview). No CSP change needed.

### Previous Story Learnings (0-1)

- Project location: `upwork-researcher/`
- Frontend: `src/` — React 19 + TypeScript + Vite 7
- Backend: `src-tauri/src/` — Rust with Tauri v2.9.1
- Testing: Vitest + React Testing Library with explicit cleanup in `src/test/setup.ts`
- Rust crate: `upwork-research-agent` (lib: `upwork_research_agent_lib`)
- Tauri invoke pattern: `import { invoke } from "@tauri-apps/api/core"`

### File Structure

```
upwork-researcher/
├── src/
│   ├── App.tsx                    # Add generate button, output display, state
│   ├── App.css                    # Add styles for button, output
│   ├── components/
│   │   ├── JobInput.tsx           # Existing (from 0-1)
│   │   ├── GenerateButton.tsx     # NEW
│   │   └── ProposalOutput.tsx     # NEW
├── src-tauri/
│   ├── Cargo.toml                 # Add reqwest, serde_json
│   └── src/
│       ├── lib.rs                 # Add generate_proposal command
│       └── claude.rs              # NEW - Claude API module
```

### Dependencies to Add

**Rust (Cargo.toml):**
```toml
reqwest = { version = "0.12", features = ["json"] }
```

**No new npm dependencies needed** — `@tauri-apps/api` already installed.

### Error Handling

- Network failure: Return user-friendly error "Unable to reach AI service. Check your internet connection."
- API error (4xx/5xx): Parse Anthropic error response, return message
- Timeout: Set 30s timeout on reqwest client, return "Generation timed out. Try again."

### Testing Strategy

- **Unit tests:** Component rendering, state transitions
- **Integration tests:** Mock `invoke` to test full flow without real API
- **No E2E API tests in spike** — manual verification acceptable

### References

- [Source: architecture.md#LLM Integration Decision]
- [Source: architecture.md#Prompt Boundary Enforcement]
- [Source: epics-stories.md#Story 0.2]
- [Source: 0-1-basic-job-input-ui.story.md#Dev Agent Record]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log
- No issues encountered during implementation
- Used environment variable `ANTHROPIC_API_KEY` instead of hardcoded key for security

### Completion Notes
- 29 tests passing across 4 test files:
  - App.test.tsx: 10 tests (integration with mocked Tauri invoke)
  - GenerateButton.test.tsx: 6 tests
  - ProposalOutput.test.tsx: 7 tests
  - JobInput.test.tsx: 6 tests (from story 0-1)
- Frontend build passes (tsc + vite build)
- Rust backend compiles successfully with reqwest + tokio
- Prompt boundary enforcement implemented (job content wrapped in delimiters, placed in user role)
- Error handling: timeout (30s), network failure, API errors all return user-friendly messages
- **Task 7 (performance verification) deferred to manual testing** — requires ANTHROPIC_API_KEY set

### File List
- `upwork-researcher/src/App.tsx` — Added state management, handleGenerate, wired components
- `upwork-researcher/src/App.css` — Added button and output styles with dark mode support
- `upwork-researcher/src/App.test.tsx` — 10 integration tests with mocked Tauri invoke
- `upwork-researcher/src/components/GenerateButton.tsx` — NEW: Generate button with loading state
- `upwork-researcher/src/components/GenerateButton.test.tsx` — NEW: 6 unit tests
- `upwork-researcher/src/components/ProposalOutput.tsx` — NEW: Output display with loading/error states
- `upwork-researcher/src/components/ProposalOutput.test.tsx` — NEW: 7 unit tests
- `upwork-researcher/src-tauri/Cargo.toml` — Added reqwest, tokio dependencies
- `upwork-researcher/src-tauri/src/lib.rs` — Added generate_proposal Tauri command
- `upwork-researcher/src-tauri/src/claude.rs` — NEW: Claude API module with HTTP client

## Senior Developer Review (AI)

**Review Date:** 2026-02-03
**Review Outcome:** Changes Requested
**Total Action Items:** 6 (1 High, 3 Medium, 2 Low)

### Findings Summary
- **[High]** Task 7 incomplete but marked as done — performance AC-4 untested
- **[Med]** HTTP client created per request (acceptable for spike, note for streaming)
- **[Med]** Tokio "full" features adds unnecessary binary size
- **[Med]** CSP consideration for future frontend fetch
- **[Low]** Hardcoded model ID
- **[Low]** Missing aria-live for accessibility

## Change Log
- 2026-02-03: Story created with comprehensive context from architecture and previous story
- 2026-02-03: Implementation complete — Claude API integration with 29 passing tests
- 2026-02-03: Code review — 6 action items created (1 High, 3 Med, 2 Low)
- 2026-02-03: Addressed review items — reduced tokio features, added aria-live accessibility
