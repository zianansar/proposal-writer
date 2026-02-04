---
status: done
assignedTo: "dev-agent"
tasksCompleted: 4
totalTasks: 4
testsWritten: true
fileList:
  - upwork-researcher/src-tauri/Cargo.toml
  - upwork-researcher/src-tauri/src/lib.rs
  - upwork-researcher/src-tauri/capabilities/default.json
  - upwork-researcher/src/components/CopyButton.tsx
  - upwork-researcher/src/components/CopyButton.test.tsx
  - upwork-researcher/src/components/ProposalOutput.tsx
  - upwork-researcher/src/components/ProposalOutput.test.tsx
  - upwork-researcher/src/test/setup.ts
  - upwork-researcher/src/App.css
  - upwork-researcher/package.json
---

# Story 0.4: Manual Copy to Clipboard

## Story

As a freelancer,
I want to manually copy the generated proposal,
So that I can paste it into Upwork's proposal form.

## Acceptance Criteria

**AC-1:** Given a proposal has been generated, When I click "Copy to Clipboard" button, Then the proposal text is copied to my system clipboard.

**AC-2:** Given I copy a proposal, Then I see a confirmation message "Copied!" that fades after a brief moment.

**AC-3:** Given a proposal is copied to clipboard, Then I can paste it into any external application.

**AC-4:** Given generation is in progress or no proposal exists, Then the copy button is disabled or hidden.

## Technical Notes

### Architecture Requirements

From architecture.md:

- **Clipboard Plain-Text-Only Rule:** Output is plain text only — no HTML, no structured metadata, no hidden fields
- **tauri-plugin-clipboard-manager:** Use this plugin for clipboard access
- **FR-13:** Manual copy only, no auto-submit
- **Safety scan advisory-only:** Copy-to-clipboard never gated by safety score (but safety not implemented in Epic 0)

### Tauri Clipboard Plugin

Per Tauri v2 documentation:
- Plugin: `tauri-plugin-clipboard-manager`
- Frontend API: `import { writeText } from '@tauri-apps/plugin-clipboard-manager'`
- Rust registration: `.plugin(tauri_plugin_clipboard_manager::init())`

### Previous Story Learnings (0-3)

From story 0-3:
- Zustand store manages streaming state: `isStreaming`, `fullText`, `tokens`
- `getStreamedText` selector concatenates tokens
- `ProposalOutput` component displays streaming/complete proposals
- App.tsx integrates store with UI

### File Structure

```
upwork-researcher/
├── src/
│   ├── components/
│   │   └── CopyButton.tsx           # NEW: Copy button with confirmation
│   │   └── CopyButton.test.tsx      # NEW: Tests
│   │   └── ProposalOutput.tsx       # Update to include CopyButton
├── src-tauri/
│   ├── Cargo.toml                   # Add clipboard plugin
│   ├── src/
│   │   └── lib.rs                   # Register clipboard plugin
│   └── capabilities/
│       └── default.json             # Add clipboard permission if needed
```

### Dependencies

**Rust (Cargo.toml):**
- `tauri-plugin-clipboard-manager = "2"`

**Frontend (package.json):**
- `@tauri-apps/plugin-clipboard-manager` - Tauri clipboard API

### UI Pattern

Per UX design specification:
- Copy button appears below the proposal output when generation is complete
- Button shows "Copy to Clipboard" initially
- On click, changes to "Copied!" with checkmark for 2 seconds
- Then returns to original state
- Disabled/hidden during streaming

## Tasks/Subtasks

- [x] Task 1: Add Tauri clipboard plugin (AC: 1, 3)
  - [x] Subtask 1.1: Add `tauri-plugin-clipboard-manager = "2"` to Cargo.toml
  - [x] Subtask 1.2: Register plugin in lib.rs with `.plugin(tauri_plugin_clipboard_manager::init())`
  - [x] Subtask 1.3: Add clipboard permission to capabilities/default.json (`clipboard-manager:allow-write-text`)
  - [x] Subtask 1.4: Install `@tauri-apps/plugin-clipboard-manager` npm package

- [x] Task 2: Create CopyButton component (AC: 1, 2, 4)
  - [x] Subtask 2.1: Create CopyButton.tsx with writeText from clipboard plugin
  - [x] Subtask 2.2: Implement "Copied!" confirmation state with 2s timeout
  - [x] Subtask 2.3: Accept disabled prop for streaming state
  - [x] Subtask 2.4: Style button with consistent CSS (light + dark mode)

- [x] Task 3: Integrate CopyButton into ProposalOutput (AC: 1, 4)
  - [x] Subtask 3.1: Add CopyButton to completed proposal view
  - [x] Subtask 3.2: Pass proposal text to CopyButton
  - [x] Subtask 3.3: Hide CopyButton during streaming and when no proposal

- [x] Task 4: Write tests (AC: all)
  - [x] Subtask 4.1: Test CopyButton renders and handles click (10 tests)
  - [x] Subtask 4.2: Test "Copied!" confirmation appears and fades
  - [x] Subtask 4.3: Test button is disabled when disabled prop is true
  - [x] Subtask 4.4: Test ProposalOutput shows CopyButton only when appropriate (5 new tests)

### Review Follow-ups (AI)
- [ ] [AI-Review][Med] Add timer cleanup on unmount to prevent state update after unmount [CopyButton.tsx:26-28] — DEFERRED to Epic 8
- [ ] [AI-Review][Low] Replace emoji icons with SVG for cross-platform consistency [CopyButton.tsx:46,51] — DEFERRED to Epic 8

## Dev Notes

### Scope Boundaries

**In scope:**
- Copy button with confirmation feedback
- Plain text clipboard write
- Disable during streaming

**Out of scope:**
- Safety checks before copy (Epic 3)
- Auto-clear clipboard after timeout (post-MVP)
- Rich text or formatting

### Fallback Plan

If Tauri clipboard plugin has issues, can fall back to browser's `navigator.clipboard.writeText()` API which may work in Tauri WebView context.

## References

- [Source: architecture.md#Clipboard Plain-Text-Only Rule]
- [Source: architecture.md#Tauri Plugin Dependencies]
- [Source: epics-stories.md#Story 0.4: Manual Copy to Clipboard]
- [Source: 0-3-streaming-ui-display.story.md]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log
- Added tauri-plugin-clipboard-manager to Cargo.toml
- Registered plugin in lib.rs
- Added clipboard-manager:allow-write-text permission to capabilities/default.json
- Installed @tauri-apps/plugin-clipboard-manager npm package
- Created CopyButton component with writeText, confirmation state, and error handling
- Integrated CopyButton into ProposalOutput for completed and error-with-partial states
- Added CSS styles for light and dark mode
- Added clipboard plugin mock to test setup
- Fixed missing afterEach import in test file
- Fixed unused waitFor import for TypeScript build

### Completion Notes
- 69 tests passing across 7 test files:
  - CopyButton.test.tsx: 10 tests (click, confirmation, disabled states, error, accessibility)
  - ProposalOutput.test.tsx: 13 tests (added 5 new tests for CopyButton integration)
  - Other existing test files unchanged
- Frontend build passes (tsc + vite build)
- Rust backend compiles with clipboard plugin
- Copy button shows "Copied!" with checkmark for 2 seconds after click
- Button disabled during streaming (hidden) and when no proposal
- Also shows on error state with partial result preserved
- Plain text only - no formatting or metadata copied

### Implementation Summary
**Rust Backend:**
- Added `tauri-plugin-clipboard-manager = "2"` dependency
- Registered plugin with `.plugin(tauri_plugin_clipboard_manager::init())`
- Added `clipboard-manager:allow-write-text` permission

**Frontend:**
- CopyButton component uses `writeText` from `@tauri-apps/plugin-clipboard-manager`
- 2-second "Copied!" confirmation state with setTimeout
- Error handling with user-friendly message
- Proper accessibility with aria-labels
- CSS styles for both light and dark themes

**Integration:**
- ProposalOutput shows CopyButton when proposal is complete
- CopyButton also available with partial results on error
- Hidden during streaming (no copy while generating)

## File List
- `upwork-researcher/src-tauri/Cargo.toml` — Added clipboard plugin dependency
- `upwork-researcher/src-tauri/src/lib.rs` — Registered clipboard plugin
- `upwork-researcher/src-tauri/capabilities/default.json` — Added clipboard permission
- `upwork-researcher/src/components/CopyButton.tsx` — NEW: Copy button with confirmation
- `upwork-researcher/src/components/CopyButton.test.tsx` — NEW: 10 tests
- `upwork-researcher/src/components/ProposalOutput.tsx` — Added CopyButton integration
- `upwork-researcher/src/components/ProposalOutput.test.tsx` — Added 5 new tests
- `upwork-researcher/src/test/setup.ts` — Added clipboard plugin mock
- `upwork-researcher/src/App.css` — Added CopyButton styles (light + dark)
- `upwork-researcher/package.json` — Added @tauri-apps/plugin-clipboard-manager

## Change Log
- 2026-02-04: Story created from epics-stories.md with architecture context
- 2026-02-04: Implementation complete — Clipboard copy with confirmation, 69 tests passing
- 2026-02-04: Code review — Approved with 2 minor items deferred to Epic 8
