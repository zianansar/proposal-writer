# Story 9.7: Auto-Update Notification UI

Status: in-progress

## Story

As a freelancer,
I want to be notified when an update is available and control when to install it,
So that updates don't interrupt my workflow during proposal writing.

## Acceptance Criteria

1. **AC-1: Non-intrusive update available toast**
   **Given** the updater detects an available non-critical update,
   **When** the check completes,
   **Then** a non-intrusive toast notification appears: "Update available: v{version}"
   **And** the toast includes "Update Now" and "Later" buttons
   **And** the toast auto-dismisses after 10 seconds if not interacted with.

2. **AC-2: Download progress with cancel**
   **Given** the user clicks "Update Now",
   **When** the update download begins,
   **Then** a progress indicator shows download percentage
   **And** the user can continue using the app while the download proceeds
   **And** a "Cancel" option is available during download.

3. **AC-3: Restart prompt after download**
   **Given** the update download completes,
   **When** the installer is ready,
   **Then** a dialog prompts: "Update downloaded. Restart to apply?"
   **And** the dialog has "Restart Now" and "Remind Me Later" options
   **And** selecting "Restart Now" closes the app and applies the update.

4. **AC-4: Re-notification and skip version**
   **Given** the user selects "Later" or dismisses the notification,
   **When** the user closes and reopens the app,
   **Then** the update notification appears again on next launch
   **And** includes a "Skip This Version" option for non-critical updates.

5. **AC-5: Settings page auto-update section**
   **Given** the Settings page exists,
   **When** the user navigates to Settings,
   **Then** there is an "Auto-Update" section with:
   - Toggle: "Check for updates automatically" (default: on)
   - Button: "Check Now" to manually trigger an update check
   - Display: "Current version: v{version}" and "Last checked: {timestamp}"
   **And** keyboard navigation works for all controls (NFR-14 accessibility).

6. **AC-6: Disabled auto-update behavior**
   **Given** auto-update is disabled in Settings,
   **When** the app launches,
   **Then** no automatic update check occurs
   **And** the user can still manually check via the "Check Now" button.

## Tasks / Subtasks

- [x] Task 1: Extend useUpdater hook for notification UI needs (AC: #1, #2, #4, #6)
  - [x] 1.1 Add `updateAvailable: boolean` to return interface — surfaces background-discovered updates (currently pendingUpdate is internal-only)
  - [x] 1.2 Add `updateInfo: UpdateInfo | null` to return interface — expose version/body/date from background check
  - [x] 1.3 Add `clearError()` function — allows UI to dismiss error banners (noted as missing in 9-6 JSDoc)
  - [x] 1.4 Add `cancelDownload()` function — aborts in-progress download (AC-2 cancel requirement)
  - [x] 1.5 Add `downloadProgress: number` state (0-100 percentage) — computed from Started/Progress/Finished events
  - [x] 1.6 Add `isDownloaded: boolean` state — tracks download completion for restart prompt (AC-3)
  - [x] 1.7 Add periodic check: if auto-update enabled, re-check every 4 hours while running (AC-1 technical note)
  - [x] 1.8 Accept `autoCheckEnabled: boolean` param — when false, skip background check on mount (AC-6)
  - [x] 1.9 Accept `skippedVersion: string | null` param — suppress notification if detected version matches skipped (AC-4)
  - [x] 1.10 Update existing tests in `useUpdater.test.ts` for new interface; add tests for new states

- [x] Task 2: Add auto-update settings to settings infrastructure (AC: #5, #6)
  - [x] 2.1 Add Zustand selector `getAutoUpdateEnabled` in `useSettingsStore.ts` — reads `auto_update_enabled` key, defaults to `true`
  - [x] 2.2 Add Zustand selector `getSkippedVersion` in `useSettingsStore.ts` — reads `skipped_version` key, defaults to `""`
  - [x] 2.3 Add Zustand selector `getLastUpdateCheck` in `useSettingsStore.ts` — reads `last_update_check` key, defaults to `""`
  - [x] 2.4 Add typed accessors in `useSettings.ts`: `autoUpdateEnabled`, `setAutoUpdateEnabled`, `skippedVersion`, `setSkippedVersion`, `lastUpdateCheck`, `setLastUpdateCheck`
  - [x] 2.5 Write unit tests for new selectors (default values, type parsing, round-trip)

- [x] Task 3: Create AutoUpdateNotification component (AC: #1, #2, #3, #4)
  - [x] 3.1 Create `src/components/AutoUpdateNotification.tsx` — multi-state notification component
  - [x] 3.2 Create `src/components/AutoUpdateNotification.css` — styled using design tokens from `tokens.css`
  - [x] 3.3 Implement **toast state** (AC-1): banner with slideDown animation at top, "Update available: v{version}" message, "Update Now" + "Later" buttons, auto-dismiss after 10s timeout
  - [x] 3.4 Implement **downloading state** (AC-2): progress bar showing download percentage, "Cancel" button, non-blocking (user can keep working)
  - [x] 3.5 Implement **ready state** (AC-3): dialog with "Update downloaded. Restart to apply?", "Restart Now" + "Remind Me Later" buttons, focus trap via `useFocusTrap`
  - [x] 3.6 Implement **dismissed state** (AC-4): "Skip This Version" option in toast, persist skipped version to settings
  - [x] 3.7 Add `role="alert"` + `aria-live="polite"` for toast; `role="dialog"` + `aria-modal="true"` for restart prompt
  - [x] 3.8 Add Escape key handler to dismiss toast (follows ThresholdAdjustmentNotification pattern)
  - [x] 3.9 Use `useAnnounce()` from LiveAnnouncer for screen reader announcements on state transitions
  - [x] 3.10 Write comprehensive tests in `src/components/AutoUpdateNotification.test.tsx`

- [x] Task 4: Add Auto-Update section to SettingsPanel (AC: #5, #6)
  - [x] 4.1 Add "Auto-Update" section to `SettingsPanel.tsx` — follows existing section pattern (`<section className="settings-section">`)
  - [x] 4.2 Add toggle: "Check for updates automatically" bound to `autoUpdateEnabled` setting (default: on)
  - [x] 4.3 Add "Check Now" button — calls `checkForUpdate()`, shows "Checking..." while in progress, displays result
  - [x] 4.4 Add version display: "Current version: v{version}" — read from `@tauri-apps/api/app` `getVersion()` or from `UpdateInfo.currentVersion`
  - [x] 4.5 Add "Last checked: {timestamp}" display — reads `lastUpdateCheck` from settings, format with `dateUtils.ts`
  - [x] 4.6 Ensure keyboard navigation works for toggle, button, and all controls
  - [x] 4.7 Write tests in `SettingsPanel.test.tsx` for new Auto-Update section

- [x] Task 5: Integrate into App.tsx (AC: #1, #5, #6)
  - [x] 5.1 Call `useUpdater` from `AppContent` component (persistent location — per 9-6 JSDoc requirement, lines 43-46)
  - [x] 5.2 Pass `autoCheckEnabled` from `useSettings().autoUpdateEnabled` into hook
  - [x] 5.3 Pass `skippedVersion` from `useSettings().skippedVersion` into hook
  - [x] 5.4 Render `<AutoUpdateNotification>` in App.tsx alongside other notifications (after network blocked toast, before main content)
  - [ ] 5.5 Persist `lastUpdateCheck` timestamp after each successful check
  - [x] 5.6 Wire notification callbacks: onUpdateNow → downloadAndInstall, onLater → dismiss, onSkip → setSkippedVersion, onRestart → relaunchApp
  - [ ] 5.7 Add integration tests for App.tsx update notification rendering

- [ ] Task 6: End-to-end validation (all ACs)
  - [ ] 6.1 Verify all 6 ACs pass with mocked updater plugin
  - [ ] 6.2 Verify screen reader announcements via LiveAnnouncer on all state transitions
  - [ ] 6.3 Verify keyboard navigation: toast dismiss (Escape), button focus, focus trap on restart dialog
  - [ ] 6.4 Verify auto-dismiss behavior: toast disappears after 10s, clears timeout on interaction
  - [ ] 6.5 Run full test suite — ensure no regressions

### Review Follow-ups (CR R1)

- [ ] [CR-R1][HIGH] H-1: Remove redundant `useUpdater()` from SettingsPanel.tsx:82 — creates second background check + timer instance, ignores user's auto-update toggle. Pass `checkForUpdate`/`isChecking` as props or shared context instead.
- [ ] [CR-R1][HIGH] H-2: `cancelDownload()` in useUpdater.ts:89-94 only resets state, does NOT abort the actual `downloadAndInstall()` call. Download continues in background. Add AbortController or document limitation.
- [ ] [CR-R1][HIGH] H-3: AutoUpdateNotification.tsx:65 — `announce()` fires on every `downloadProgress` change, spamming screen readers. Throttle to milestone announcements (0%, 25%, 50%, 75%, 100%).
- [ ] [CR-R1][HIGH] H-4: App.tsx:158-166 `handleSkipVersion` uses `invoke("set_setting")` directly — bypasses Zustand optimistic update. Use `setSkippedVersion()` from useSettings instead.
- [ ] [CR-R1][MEDIUM] M-1: useSettings.test.ts has zero tests for `autoUpdateEnabled`, `setAutoUpdateEnabled`, `skippedVersion`, `setSkippedVersion`, `lastUpdateCheck`, `setLastUpdateCheck`. Add round-trip tests.
- [ ] [CR-R1][MEDIUM] M-2: AutoUpdateNotification.tsx:46 `dismissed` state never resets for new updates. Once dismissed, notification won't appear for ANY future version. Track dismissed version and reset on version change.
- [ ] [CR-R1][MEDIUM] M-3: SettingsPanel.tsx:635 button label "Check for Updates" doesn't match AC-5 spec "Check Now". Update label and corresponding test assertion.
- [ ] [CR-R1][MEDIUM] M-4: `lastUpdateCheck` only persisted on manual check (SettingsPanel:319). Background checks from useUpdater don't persist timestamp. Task 5.5 requires persistence after each successful check.
- [ ] [CR-R1][MEDIUM] M-5: useUpdater.test.ts missing `vi.mock('@tauri-apps/api/core')` for `invoke`. `get_failed_update_versions_command` silently fails — skip list functionality untested.
- [ ] [CR-R1][LOW] L-1: SettingsPanel.test.tsx inconsistently uses `flushPromises()` vs `waitFor()` — standardize approach.
- [ ] [CR-R1][LOW] L-2: AutoUpdateNotification.test.tsx missing test for auto-dismiss timer clearing on button interaction.
- [ ] [CR-R1][LOW] L-3: SettingsPanel.test.tsx:73-79 useUpdater mock returns incomplete shape — fragile if SettingsPanel uses more hook fields later.

## Dev Notes

### Architecture Compliance

- **NFR-13 (Safe Updates):** This story handles the UI layer for user-controlled updates. Atomic update installation and rollback are handled in Stories 9.8 and 9.9.
- **NFR-14 (Accessibility):** All controls must be keyboard-navigable. Focus trap on restart dialog. ARIA live regions for screen reader users.
- **NFR-16 (Auto-Update):** This story implements the opt-in/opt-out mechanism. Story 9.8 will add mandatory critical update enforcement that overrides the toggle.
- **AR-14 (Network Allowlist):** No changes needed — the updater plugin operates via Rust-side `reqwest`, independent of the webview CSP and `network.rs` allowlist (confirmed in Story 9-6 dev notes).

### Critical Technical Details

**useUpdater Hook (Story 9-6 — already implemented):**
- File: `upwork-researcher/src/hooks/useUpdater.ts` (184 lines)
- Provides: `checkForUpdate()`, `downloadAndInstall(onProgress)`, `relaunchApp()`, `isChecking`, `isDownloading`, `error`
- Background check on mount sets `pendingUpdate` but does NOT expose `updateAvailable` — **Task 1 must fix this**
- No `clearError` function — **Task 1 must add this**
- Download progress callback receives `{ event: 'Started'|'Progress'|'Finished', data?: { contentLength?, chunkLength? } }`
- **MUST be called from persistent component** (App root, not conditional render)

**Tauri Plugin Process (for relaunch):**
```typescript
import { relaunch } from '@tauri-apps/plugin-process';
// Already wrapped in useUpdater.relaunchApp()
```

**App Version Access:**
```typescript
import { getVersion } from '@tauri-apps/api/app';
const version = await getVersion(); // Returns string like "0.1.1"
```
Mock in tests: `vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('0.1.1') }));`

**Download Progress Calculation:**
```typescript
// From useUpdater downloadAndInstall callback:
// event.event === 'Started': event.data.contentLength = total bytes
// event.event === 'Progress': event.data.chunkLength = bytes in this chunk
// event.event === 'Finished': download complete
// Calculate: progressPercent = (totalReceived / contentLength) * 100
```

**Settings Keys (new for this story):**
| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `auto_update_enabled` | `"true"\|"false"` | `"true"` | Toggle for automatic update checks |
| `skipped_version` | string | `""` | Version user chose to skip |
| `last_update_check` | ISO timestamp string | `""` | Last successful check timestamp |

**Periodic Check Timer:**
- Check frequency: on launch + every 4 hours (14,400,000ms) while running
- Use `setInterval` in useEffect, clear on unmount
- Only when `autoCheckEnabled` is true
- If update found during periodic check, show toast

### UI Component Architecture

**AutoUpdateNotification states:**
```
idle → toast (update detected) → downloading (user clicked Update Now) → ready (download complete) → [restart or dismiss]
                                ↘ dismissed (user clicked Later/Skip)
```

**Toast appearance** — Model after `ThresholdAdjustmentNotification`:
- Position: fixed, top of viewport, centered horizontally
- z-index: `var(--z-toast)` (200)
- Animation: `slideDown` keyframes (translateY from -100% to 0)
- Background: `var(--color-bg-secondary)` with `1px solid var(--color-primary)` border
- Shadow: `var(--shadow-lg)`

**Progress bar** — During download:
- Use `var(--color-primary)` for fill, `var(--color-bg-tertiary)` for track
- Height: 4-6px, border-radius: `var(--radius-sm)`
- Percentage text: `var(--font-size-sm)` below bar

**Restart dialog** — After download:
- Modal overlay with focus trap (use `useFocusTrap` hook)
- `role="dialog"` `aria-modal="true"` `aria-labelledby` pointing to heading
- "Restart Now" as primary button (`var(--color-success)` green)
- "Remind Me Later" as secondary button

**CSS class naming convention** (BEM-like, matches codebase):
```
.auto-update-notification
.auto-update-notification__content
.auto-update-notification__title
.auto-update-notification__message
.auto-update-notification__actions
.auto-update-notification__button--primary
.auto-update-notification__button--secondary
.auto-update-notification__progress
.auto-update-notification__progress-bar
.auto-update-notification__progress-text
```

### Previous Story Intelligence (9-6)

**Key learnings from Story 9-6:**
- `useUpdater` hook is well-tested (17 tests) but designed as infrastructure — UI surface area intentionally deferred to this story
- CR R1-R3 found and fixed: inconsistent `act()` usage in tests, `waitFor` on non-reactive variables, missing config validation tests
- **Pattern to follow:** Always wrap `checkForUpdate()` / state-changing calls in `act()` for React 18+ compliance
- **Test mock setup:** `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` are mocked at module level in `src/test/setup.ts`
- Windows install mode confirmed as `passive` (not `currentUser` — corrected in CR R1)
- Background check swallows errors intentionally (console.debug only)

**Files from 9-6 (will be modified):**
- `src/hooks/useUpdater.ts` — extend with new state/functions
- `src/hooks/__tests__/useUpdater.test.ts` — extend with new test cases

**Key Code Review Patterns to Follow:**
- Use `act()` for all state updates in tests (pattern established in 9-6 R2/R3)
- No `setTimeout(resolve, N)` for timing — use `act()` and `waitFor` properly
- All `role="dialog"` elements need focus trap and Escape handler
- All notifications need ARIA live region and `useAnnounce()` call

### Settings Panel Integration Pattern

**Existing section structure** (from `SettingsPanel.tsx`):
```tsx
<section className="settings-section">
  <h3>Section Title</h3>
  <div className="settings-field">
    <label htmlFor="input-id">Label text</label>
    <p className="settings-help">Help description</p>
    {/* Input/toggle/button */}
  </div>
</section>
```

**Existing sections order:** Profile → Logging → Safety → Privacy → Humanization → Onboarding → Voice Settings → Data Management

**Add "Auto-Update" section between Privacy and Humanization** (or after Data Management — use judgment).

**Settings persistence:** Use `useSettings()` hook which wraps Zustand store → Tauri `invoke("set_setting", { key, value })`. No Rust backend changes needed — the generic key-value store already supports any new keys.

### Testing Strategy

- **AutoUpdateNotification component:** Vitest + React Testing Library. Test all 4 states (toast, downloading, ready, dismissed). Test auto-dismiss timer. Test keyboard interactions. Test ARIA attributes.
- **useUpdater hook extensions:** Extend existing `useUpdater.test.ts`. Mock `check()` returns, test `updateAvailable`, `downloadProgress`, `cancelDownload`, periodic check timer.
- **SettingsPanel section:** Extend existing `SettingsPanel.test.tsx`. Test toggle state, Check Now button, version display, last checked display.
- **App.tsx integration:** Test notification renders when update available, test settings integration, test dismiss flow.
- **Mock pattern:** `@tauri-apps/plugin-updater` already mocked in test setup. Add `@tauri-apps/api/app` mock for `getVersion()`.

### Project Structure Notes

**New files:**
- `upwork-researcher/src/components/AutoUpdateNotification.tsx`
- `upwork-researcher/src/components/AutoUpdateNotification.css`
- `upwork-researcher/src/components/AutoUpdateNotification.test.tsx`

**Modified files:**
- `upwork-researcher/src/hooks/useUpdater.ts` — extend return interface
- `upwork-researcher/src/hooks/__tests__/useUpdater.test.ts` — extend tests
- `upwork-researcher/src/stores/useSettingsStore.ts` — add selectors
- `upwork-researcher/src/hooks/useSettings.ts` — add typed accessors
- `upwork-researcher/src/components/SettingsPanel.tsx` — add Auto-Update section
- `upwork-researcher/src/components/SettingsPanel.test.tsx` — add section tests
- `upwork-researcher/src/App.tsx` — integrate hook + notification component

**No Rust backend changes required** — settings key-value store is already generic.

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 9.7]
- [Source: _bmad-output/implementation-artifacts/9-6-auto-updater-plugin-integration.story.md]
- [Source: upwork-researcher/src/hooks/useUpdater.ts — hook interface and JSDoc notes]
- [Source: upwork-researcher/src/components/ThresholdAdjustmentNotification.tsx — notification UI pattern]
- [Source: upwork-researcher/src/components/SettingsPanel.tsx — settings section pattern]
- [Source: upwork-researcher/src/stores/useSettingsStore.ts — Zustand settings pattern]
- [Source: upwork-researcher/src/hooks/useSettings.ts — typed settings accessor pattern]
- [Source: upwork-researcher/src/styles/tokens.css — design tokens]
- [Source: upwork-researcher/src/components/LiveAnnouncer.tsx — screen reader announcement pattern]
- [Source: upwork-researcher/src/hooks/useFocusTrap.ts — focus trap pattern]
- [Source: Tauri v2 Updater Plugin — https://v2.tauri.app/plugin/updater/]

## Dev Agent Record

### Agent Model Used

Unknown (Dev Agent Record was empty at time of code review)

### Debug Log References

### Completion Notes List

- CR R1 (2026-02-16, claude-opus-4-6): Tasks 1-3 were marked [x], Tasks 4-6 marked [ ] but Tasks 4-5 were actually implemented. Status was wrong ("ready-for-dev" instead of "in-progress"). Corrected task checkboxes and status. Added 12 review follow-up items (4 HIGH, 5 MEDIUM, 3 LOW). Key issues: redundant useUpdater in SettingsPanel, cancelDownload doesn't abort, screen reader spam, handleSkipVersion bypasses store.

### File List

- `upwork-researcher/src/hooks/useUpdater.ts` — extended with updateAvailable, updateInfo, clearError, cancelDownload, downloadProgress, isDownloaded, periodic check, autoCheckEnabled, skippedVersion params
- `upwork-researcher/src/hooks/__tests__/useUpdater.test.ts` — extended with Story 9.7 + 9.8 tests
- `upwork-researcher/src/stores/useSettingsStore.ts` — added getAutoUpdateEnabled, getSkippedVersion, getLastUpdateCheck selectors
- `upwork-researcher/src/stores/useSettingsStore.test.ts` — added selector tests for auto-update settings
- `upwork-researcher/src/hooks/useSettings.ts` — added autoUpdateEnabled, setAutoUpdateEnabled, skippedVersion, setSkippedVersion, lastUpdateCheck, setLastUpdateCheck accessors
- `upwork-researcher/src/hooks/useSettings.test.ts` — (no new tests for auto-update accessors — M-1 finding)
- `upwork-researcher/src/components/AutoUpdateNotification.tsx` — NEW: multi-state notification (toast/downloading/ready)
- `upwork-researcher/src/components/AutoUpdateNotification.css` — NEW: styles with design tokens
- `upwork-researcher/src/components/AutoUpdateNotification.test.tsx` — NEW: comprehensive component tests
- `upwork-researcher/src/components/SettingsPanel.tsx` — added Auto-Update section (toggle, Check Now, version display, last checked)
- `upwork-researcher/src/components/SettingsPanel.test.tsx` — added Auto-Update section tests
- `upwork-researcher/src/App.tsx` — integrated useUpdater with settings, rendered AutoUpdateNotification, wired callbacks
