---
status: ready-for-dev
---

# Story 3.9: Core Keyboard Shortcuts

## Story

As a freelancer,
I want to use keyboard shortcuts for common actions,
So that I can work efficiently without reaching for my mouse.

## Acceptance Criteria

**Given** I am on the Generate tab with job content entered
**When** I press Cmd/Ctrl + Enter
**Then** proposal generation starts (same as clicking Generate button)
**And** the shortcut does nothing if generation is already in progress or job input is empty

**Given** I am typing in the job input textarea
**When** I press Cmd/Ctrl + Enter
**Then** generation still starts (this shortcut intentionally works from within the textarea)

**Given** a completed proposal is displayed
**When** I press Cmd/Ctrl + Shift + C
**Then** the proposal copy flow triggers including pre-flight safety analysis (Story 3.1)
**And** the SafetyWarningModal appears if risk threshold is exceeded (Story 3.2)
**And** the shortcut does nothing if no proposal exists or generation is in progress

**Given** I am typing in any text input or textarea
**When** I press Cmd/Ctrl + C or Cmd/Ctrl + V
**Then** native clipboard behavior is preserved (system copy/paste works normally)

**Given** I am navigating the app with keyboard
**When** I press Tab / Shift+Tab
**Then** focus moves between interactive elements in logical visual order (left-to-right, top-to-bottom)
**And** all focused elements display a clearly visible focus indicator

**Given** I hover over the Generate button or Copy button
**When** the tooltip appears
**Then** it displays the keyboard shortcut with the correct platform modifier (⌘ on macOS, Ctrl on Windows/Linux)

## Dev Notes

### Shortcut Conflict Resolutions

| Action | UX Spec Said | Story Uses | Reason |
|--------|-------------|------------|--------|
| Generate | Cmd/Ctrl+G | Cmd/Ctrl+Enter | Industry-standard "submit" pattern (Slack, Discord, ChatGPT). More discoverable. |
| Copy | Cmd/Ctrl+C | Cmd/Ctrl+Shift+C | Cmd/Ctrl+C is the system copy shortcut. Intercepting it breaks native text selection copy in textareas and the proposal output. The copy action is also async (runs Perplexity safety analysis), so instant Ctrl+C behavior is impossible. |

These deviations are intentional. Story 8.2 (Complete Keyboard Navigation) will revisit all shortcut assignments.

### Platform Detection

- Detect macOS via `navigator.platform` containing "Mac" (or `navigator.userAgentData?.platform`)
- macOS: check `e.metaKey` (⌘ Command)
- Windows/Linux: check `e.ctrlKey` (Ctrl)
- Display symbols: macOS → `⌘↵` / `⌘⇧C`, Windows → `Ctrl+Enter` / `Ctrl+Shift+C`

### Safety Analysis Integration

The copy shortcut MUST trigger the same pre-flight Perplexity analysis pipeline as CopyButton (Stories 3.1, 3.2). To avoid duplicating logic:
- Extract copy+analysis logic from CopyButton.tsx into a reusable `useSafeCopy` hook
- Both CopyButton and the keyboard shortcut call the same hook
- If analysis shows risk, SafetyWarningModal must appear regardless of whether triggered by click or shortcut

### Focus Indicator Pattern

- Match existing codebase: cyan `#24c8db` accent with `box-shadow` for inputs, blue `#3b82f6` outline for buttons
- Use `:focus-visible` (not `:focus`) — only show indicators for keyboard navigation, not mouse clicks
- Full accessibility focus overhaul deferred to Epic 8 (Story 8.2)

### Existing Keyboard Handlers (do not break)

- SafetyWarningModal: Escape key handler
- OnboardingWizard: Escape key handler
- New shortcuts must coexist without conflict

### Cross-References

- **Story 3.1** — Pre-flight Perplexity analysis (copy shortcut must trigger this)
- **Story 3.2** — Safety warning modal (must appear on risky copy, even from shortcut)
- **Story 8.2** — Complete keyboard navigation (builds on this story)
- **Story 6.5** — Formatting shortcuts for rich text editor (complementary, not overlapping)
- **AR (Architecture):** "All interactive elements: visible focus ring", "Tab order follows visual order"

## Tasks

### Task 1: Create platform detection utility

- [ ] 1.1 Create `src/hooks/usePlatform.ts` with `usePlatform()` hook returning `{ isMac: boolean }`
- [ ] 1.2 Detect via `navigator.platform` (check for "Mac" prefix)
- [ ] 1.3 Export `getShortcutDisplay(action: 'generate' | 'copy'): string` helper that returns platform-aware shortcut text (e.g., `"⌘↵"` or `"Ctrl+Enter"`)

### Task 2: Extract safe copy logic into reusable hook

- [ ] 2.1 Create `src/hooks/useSafeCopy.ts`
- [ ] 2.2 Move copy + Perplexity analysis logic from CopyButton.tsx into the hook
- [ ] 2.3 Hook state: `{ analyzing, copied, error, showWarningModal, analysisResult }`
- [ ] 2.4 Hook API: `{ triggerCopy(text: string), dismissWarning(), overrideCopy(), state }`
- [ ] 2.5 Refactor CopyButton.tsx to use `useSafeCopy` — verify identical behavior after refactor
- [ ] 2.6 Ensure SafetyWarningModal can be rendered from either CopyButton context or App-level context

### Task 3: Create useKeyboardShortcuts hook

- [ ] 3.1 Create `src/hooks/useKeyboardShortcuts.ts`
- [ ] 3.2 Single `keydown` listener on `window` (register in useEffect, clean up on unmount)
- [ ] 3.3 Accept config: `{ onGenerate, onCopy, canGenerate: boolean, canCopy: boolean }`
- [ ] 3.4 Cmd/Ctrl+Enter → call `onGenerate` when `canGenerate` is true
- [ ] 3.5 Cmd/Ctrl+Shift+C → call `onCopy` when `canCopy` is true
- [ ] 3.6 Call `e.preventDefault()` only for intercepted shortcuts
- [ ] 3.7 Use `usePlatform()` for modifier key detection

### Task 4: Integrate in App.tsx

- [ ] 4.1 Call `useKeyboardShortcuts` in App.tsx
- [ ] 4.2 Wire `onGenerate` → existing `handleGenerate` function
- [ ] 4.3 Call `useSafeCopy` at App level, wire `onCopy` → `triggerCopy(proposalText)`
- [ ] 4.4 Compute `canGenerate`: `activeView === "generate" && jobContent.trim() !== "" && !isStreaming`
- [ ] 4.5 Compute `canCopy`: proposal text exists AND generation complete AND not streaming
- [ ] 4.6 Render SafetyWarningModal from App level for shortcut-triggered copies

### Task 5: Add shortcut hints to buttons

- [ ] 5.1 Add `title` attribute to GenerateButton with platform-aware shortcut text
- [ ] 5.2 Add `title` attribute to CopyButton with platform-aware shortcut text
- [ ] 5.3 Optionally show shortcut hint as secondary text on the button label (e.g., "Generate ⌘↵")

### Task 6: Add focus-visible styles

- [ ] 6.1 Add `:focus-visible` styles to `.generate-btn` in App.css (blue outline, 2px offset)
- [ ] 6.2 Add `:focus-visible` styles to `.copy-btn` in App.css
- [ ] 6.3 Add `:focus-visible` styles to navigation tab buttons in App.css
- [ ] 6.4 Add `:focus-visible` styles to `.export-btn` in App.css
- [ ] 6.5 Verify Tab order: Nav tabs → Job Input → Generate Button → Proposal Output → Copy Button
- [ ] 6.6 Prefer natural DOM order over explicit `tabIndex` (only add `tabIndex` if DOM order is wrong)

### Task 7: Write tests

- [ ] 7.1 Create `src/hooks/__tests__/useKeyboardShortcuts.test.ts`
- [ ] 7.2 Test: Cmd+Enter (Mac) / Ctrl+Enter (Win) triggers onGenerate when canGenerate=true
- [ ] 7.3 Test: shortcut does NOT trigger when canGenerate=false
- [ ] 7.4 Test: Cmd+Shift+C / Ctrl+Shift+C triggers onCopy when canCopy=true
- [ ] 7.5 Test: shortcut does NOT trigger when canCopy=false
- [ ] 7.6 Create `src/hooks/__tests__/useSafeCopy.test.ts`
- [ ] 7.7 Test: triggerCopy runs analysis and copies on safe result
- [ ] 7.8 Test: triggerCopy shows warning modal on risky result
- [ ] 7.9 Test: CopyButton still works identically after refactor
- [ ] 7.10 Test: platform detection returns correct modifier

## Estimated File Changes

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/usePlatform.ts` | Create | Platform detection + shortcut display helper |
| `src/hooks/useSafeCopy.ts` | Create | Extracted copy + safety analysis logic |
| `src/hooks/useKeyboardShortcuts.ts` | Create | Centralized keyboard shortcut handler |
| `src/hooks/__tests__/useKeyboardShortcuts.test.ts` | Create | Shortcut hook tests |
| `src/hooks/__tests__/useSafeCopy.test.ts` | Create | Safe copy hook tests |
| `src/App.tsx` | Modify | Integrate hooks, wire callbacks, render modal |
| `src/components/CopyButton.tsx` | Modify | Refactor to use useSafeCopy hook |
| `src/components/CopyButton.test.tsx` | Modify | Update for refactored CopyButton |
| `src/components/GenerateButton.tsx` | Modify | Add shortcut tooltip hint |
| `src/App.css` | Modify | Add :focus-visible styles for buttons and nav |
