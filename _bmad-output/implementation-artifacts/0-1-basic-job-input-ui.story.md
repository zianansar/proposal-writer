---
status: review
assignedTo: "dev-agent"
tasksCompleted: 5
totalTasks: 5
testsWritten: true
fileList:
  - upwork-researcher/package.json
  - upwork-researcher/vite.config.ts
  - upwork-researcher/src-tauri/tauri.conf.json
  - upwork-researcher/src/App.tsx
  - upwork-researcher/src/App.css
  - upwork-researcher/src/App.test.tsx
  - upwork-researcher/src/components/JobInput.tsx
  - upwork-researcher/src/components/JobInput.test.tsx
  - upwork-researcher/src/test/setup.ts
---

# Story 0.1: Basic Job Input UI

## Story

As a freelancer,
I want to paste a job post URL or text into the application,
So that I can start the proposal generation process quickly.

## Acceptance Criteria

**Given** the app is running
**When** I open the main window
**Then** I see a text input area for job post content
**And** I can paste either a URL or raw job text
**And** the input area has placeholder text explaining what to paste

## Technical Notes

- Simple textarea component, no database persistence yet
- URL vs text detection not required (both treated as text)
- No validation required in spike
- Tech stack: Tauri v2 + React 19 + Vite 7 + Rust (per architecture.md)
- This is the first story — project scaffold must be created

## Dev Notes

- **AR**: Tauri v2 with React 19 frontend, Rust backend
- **NFR-1**: Startup time <2 seconds
- **NFR-4**: UI response <100ms
- This is a walking skeleton / spike — keep it minimal
- No database, no API calls, no persistence

## Tasks/Subtasks

- [x] Task 1: Initialize Tauri v2 + React 19 + Vite project scaffold
  - [x] Subtask 1.1: Create Tauri v2 project with React + TypeScript template
  - [x] Subtask 1.2: Verify project builds and launches successfully
  - [x] Subtask 1.3: Configure project metadata (name, version, window title)
- [x] Task 2: Create basic App layout component
  - [x] Subtask 2.1: Create minimal App component with header and main content area
  - [x] Subtask 2.2: Add basic CSS styling for layout
- [x] Task 3: Implement JobInput component with textarea
  - [x] Subtask 3.1: Create JobInput component with textarea element
  - [x] Subtask 3.2: Add placeholder text explaining what to paste
  - [x] Subtask 3.3: Wire up state management for textarea value
- [x] Task 4: Write unit tests for components
  - [x] Subtask 4.1: Set up Vitest + React Testing Library
  - [x] Subtask 4.2: Write tests for App component rendering
  - [x] Subtask 4.3: Write tests for JobInput component (renders, placeholder, input handling)
- [x] Task 5: Verify acceptance criteria end-to-end
  - [x] Subtask 5.1: App launches and shows text input area
  - [x] Subtask 5.2: User can paste URL or raw text
  - [x] Subtask 5.3: Placeholder text is visible

### Review Follow-ups (AI)
- [x] [AI-Review][High] Add restrictive CSP to tauri.conf.json instead of `null` [src-tauri/tauri.conf.json:21]
- [x] [AI-Review][Med] Remove dead `greet` command from Rust backend [src-tauri/src/lib.rs:3]
- [x] [AI-Review][Med] Delete leftover scaffold asset `src/assets/react.svg`
- [x] [AI-Review][Med] Update File List to document all scaffold-generated files
- [x] [AI-Review][Med] Fix Tauri API version mismatch — pin tauri Rust crate to =2.9.1 to match npm @tauri-apps/api
- [x] [AI-Review][Low] Set globals: false and add explicit cleanup to test setup
- [x] [AI-Review][Low] Rename Rust crate from auto-generated path name to `upwork-research-agent` [src-tauri/Cargo.toml]

## Dev Agent Record

### Implementation Plan
- Scaffolded Tauri v2 + React 19 + Vite 7 + TypeScript project using `create-tauri-app`
- Installed Rust toolchain (rustc 1.93.0) as prerequisite
- Replaced boilerplate App with minimal layout: heading + JobInput component
- JobInput: controlled textarea with label, placeholder, and onChange callback prop
- Set up Vitest with jsdom + React Testing Library for unit testing

### Debug Log
- No issues encountered during implementation

### Completion Notes
- 9 tests passing (3 App, 6 JobInput): rendering, placeholder, label, typing, pasting, callback
- Frontend build passes (tsc + vite build)
- Rust backend compiles successfully
- All acceptance criteria satisfied: textarea visible, accepts URL/text paste, placeholder present
- Review follow-ups resolved: CSP added, dead code removed, scaffold cleaned, crate renamed, versions pinned, test setup fixed

## File List
- `upwork-researcher/package.json` — project config with test scripts
- `upwork-researcher/package-lock.json` — dependency lockfile (scaffold-generated)
- `upwork-researcher/vite.config.ts` — vite + vitest config
- `upwork-researcher/tsconfig.json` — TypeScript config (scaffold-generated)
- `upwork-researcher/tsconfig.node.json` — TypeScript node config (scaffold-generated)
- `upwork-researcher/index.html` — HTML entry point (scaffold-generated)
- `upwork-researcher/src/main.tsx` — React entry point (scaffold-generated)
- `upwork-researcher/src/vite-env.d.ts` — Vite type declarations (scaffold-generated)
- `upwork-researcher/src/App.tsx` — main app component
- `upwork-researcher/src/App.css` — app styles
- `upwork-researcher/src/App.test.tsx` — App component tests
- `upwork-researcher/src/components/JobInput.tsx` — job input textarea component
- `upwork-researcher/src/components/JobInput.test.tsx` — JobInput tests
- `upwork-researcher/src/test/setup.ts` — vitest setup (jest-dom matchers + cleanup)
- `upwork-researcher/src-tauri/tauri.conf.json` — Tauri app metadata (CSP, name, title, window size)
- `upwork-researcher/src-tauri/Cargo.toml` — Rust crate config (renamed to upwork-research-agent)
- `upwork-researcher/src-tauri/Cargo.lock` — Rust dependency lockfile
- `upwork-researcher/src-tauri/build.rs` — Tauri build script (scaffold-generated)
- `upwork-researcher/src-tauri/src/main.rs` — Rust binary entry point
- `upwork-researcher/src-tauri/src/lib.rs` — Rust library (Tauri app builder)
- `upwork-researcher/src/assets/react.svg` — DELETED (scaffold leftover removed)

## Senior Developer Review (AI)

**Review Date:** 2026-02-02
**Review Outcome:** Changes Requested
**Total Action Items:** 7 (1 High, 4 Medium, 2 Low)

### Action Items
- [x] [High] Add restrictive CSP to tauri.conf.json — `csp: null` disables all protections
- [x] [Med] Remove dead `greet` Tauri command from lib.rs
- [x] [Med] Delete leftover scaffold asset `src/assets/react.svg`
- [x] [Med] Update File List to document all scaffold-generated files
- [x] [Med] Fix Tauri API version mismatch — pinned Rust crate to =2.9.1
- [x] [Low] Set globals: false and add explicit cleanup to test setup
- [x] [Low] Rename Rust crate from auto-generated path name to `upwork-research-agent`

## Change Log
- 2026-02-02: Story implemented — Tauri v2 project scaffold + JobInput UI with 9 passing tests
- 2026-02-02: Code review — 7 action items created (1 High, 4 Med, 2 Low)
- 2026-02-02: Addressed code review findings — 7 items resolved
