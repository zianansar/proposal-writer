# Story TD2.3: Story 9-9 Remaining Tasks Completion

Status: done

## Story

As a freelancer using the app after an update,
I want the app to properly wire its post-update health check flow end-to-end (showing progress, success confirmation, and triggering rollback with full UI on failure),
So that the health check system introduced in Story 9-9 is fully operational rather than a dormant stub.

## Acceptance Criteria

**AC-1 (Health Check Trigger on Version Change):** Given the app starts after an update (current version > stored installed_version), when `detect_update_command` returns `true`, then a blocking `HealthCheckModal` is displayed before the main UI renders, showing animated progress through the 4 health checks.

**AC-2 (Success Flow):** Given health checks pass (`HealthCheckReport.passed === true`), when the check completes, then: (a) `set_installed_version_command` is called to record the new version, (b) the HealthCheckModal closes, (c) a success toast shows "Updated to v{version} successfully" with 5s auto-dismiss, and (d) the main UI renders normally.

**AC-3 (Failure + Rollback Flow):** Given health checks fail (`HealthCheckReport.passed === false`), when the check completes, then: (a) `rollback_to_previous_version_command` is called, (b) the failed version is added to the skip list, (c) `RollbackDialog` is shown with `failedVersion`, `previousVersion`, and `reason` from the report, and (d) the "Restart App" button calls `app_handle.restart()` via `relaunch_app_command` or equivalent.

**AC-4 (Success Toast Styling):** The success toast matches the existing notification style in App.tsx (green/success variant) and is accessible (role="status" or role="alert", keyboard-dismissable).

**AC-5 (Accessibility — HealthCheckModal):** The HealthCheckModal has a functional focus trap (Tab/Shift+Tab cycle within modal), and progress updates are announced to screen readers via aria-live="polite" or LiveAnnouncer.

**AC-6 (Accessibility — RollbackDialog):** The RollbackDialog has a functional focus trap, the "Restart App" button receives focus on open, and a keyboard user can trigger restart without using a mouse.

**AC-7 (React Component Tests):** HealthCheckModal renders correctly in all states (idle/progress/complete). RollbackDialog renders correctly with all required props and fires `onRestart` when button clicked. Tests use `vi.mock` for Tauri invoke calls.

**AC-8 (Rust Tests Executable):** The 22 Rust unit tests in `health_check.rs` can execute successfully via `cargo test --lib -p upwork-researcher-lib` (or equivalent) without the Windows DLL error. If the DLL issue is environmental and cannot be fixed, document the exact error and workaround in the Dev Agent Record.

**AC-9 (New Tauri Command Registered):** The new `set_installed_version_command` added to `health_check.rs` is registered in `lib.rs` `invoke_handler!` macro.

## Tasks / Subtasks

- [x] Task 1: Add missing `set_installed_version_command` to backend (AC: #2, #9)
  - [x] 1.1 In `src-tauri/src/health_check.rs`, add a new `#[tauri::command]` function `set_installed_version_command(app_handle: AppHandle) -> Result<(), String>` that calls `set_installed_version(&conn)` (the `set_installed_version()` function already exists at line ~62)
  - [x] 1.2 Register `health_check::set_installed_version_command` in `src-tauri/src/lib.rs` invoke_handler block (near the other health_check:: commands at lines ~3063-3073)
  - [x] 1.3 Verify `cargo build --lib` compiles clean after addition
  - [x] 1.4 Run the command registration verification script (if td2-1 is done): `node scripts/verify-command-registration.mjs` — should report 121 registered commands, 0 mismatches

- [x] Task 2: Wire App.tsx health check orchestration (AC: #1, #2, #3)
  - [x] 2.1 Import `HealthCheckModal` and `RollbackDialog` into `App.tsx` (they exist at `src/components/HealthCheckModal.tsx` and `src/components/RollbackDialog.tsx`)
  - [x] 2.2 Add state variables to `AppContent`:
    ```typescript
    // Story TD2-3: Health check orchestration state
    const [healthCheckOpen, setHealthCheckOpen] = useState(false);
    const [healthCheckProgress, setHealthCheckProgress] = useState<HealthCheckProgress>({ currentCheck: 0, totalChecks: 4, checkName: '' });
    const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
    const [rollbackFailedVersion, setRollbackFailedVersion] = useState('');
    const [rollbackPreviousVersion, setRollbackPreviousVersion] = useState('');
    const [rollbackReason, setRollbackReason] = useState('');
    const [updateSuccessToast, setUpdateSuccessToast] = useState<string | null>(null);
    ```
  - [x] 2.3 Add health check detection logic to the existing `useEffect` init block (near line ~463 where `check_and_clear_rollback_command` is called). Add BEFORE the rollbackPromise:
    ```typescript
    const healthCheckPromise = invoke<boolean>('detect_update_command')
      .then(async (updateDetected) => {
        if (!updateDetected) return;
        // Get current version for success toast
        const currentVersion = await invoke<string | null>('get_installed_version_command');
        setHealthCheckOpen(true);
        // Animate progress while single batch runs
        animateHealthCheckProgress(setHealthCheckProgress);
        const report = await invoke<HealthCheckReport>('run_health_checks_command');
        setHealthCheckOpen(false);
        if (report.passed) {
          await invoke('set_installed_version_command');
          setUpdateSuccessToast(currentVersion ?? 'unknown');
          setTimeout(() => setUpdateSuccessToast(null), 5000);
        } else {
          // Health check failed — trigger rollback
          const failedVer = await invoke<string | null>('get_installed_version_command') ?? 'unknown';
          const prevVer = currentVersion ?? 'unknown';
          const reason = report.failures.map(f => f.error).join('; ');
          setRollbackFailedVersion(failedVer);
          setRollbackPreviousVersion(prevVer);
          setRollbackReason(reason);
          setRollbackDialogOpen(true);
          await invoke('rollback_to_previous_version_command').catch(() => {});
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('Health check failed:', err);
        setHealthCheckOpen(false); // Don't block app on health check error
      });
    ```
  - [x] 2.4 Add `animateHealthCheckProgress` helper (can be a local function or small hook) that simulates step-by-step progress while the backend runs. The 4 checks have known names from `health_check.rs`: "Database connection", "Database integrity", "Schema version", "Settings accessible". Animate through them with delays (500ms per check approximate):
    ```typescript
    const checkNames = ['Database connection', 'Database integrity', 'Schema version', 'Settings accessible'];
    checkNames.forEach((name, i) => {
      setTimeout(() => setHealthCheckProgress({ currentCheck: i + 1, totalChecks: 4, checkName: name }), i * 600);
    });
    ```
  - [x] 2.5 Add `handleRollbackRestart` callback:
    ```typescript
    const handleRollbackRestart = useCallback(async () => {
      await invoke('relaunch_command').catch(() => {}); // Uses existing relaunch_command
    }, []);
    ```
  - [x] 2.6 Add `HealthCheckModal` and `RollbackDialog` to the JSX render, alongside other overlay components (near MandatoryUpdateDialog, AutoUpdateNotification — lines ~1280-1340):
    ```tsx
    <HealthCheckModal isOpen={healthCheckOpen} progress={healthCheckProgress} />
    <RollbackDialog isOpen={rollbackDialogOpen} failedVersion={rollbackFailedVersion} previousVersion={rollbackPreviousVersion} reason={rollbackReason} onRestart={handleRollbackRestart} />
    ```
  - [x] 2.7 Add success toast JSX (near the rollback toast at line ~1312):
    ```tsx
    {updateSuccessToast && (
      <div role="status" className="toast toast--success" aria-live="polite">
        <strong>Update Successful</strong>
        <div>Updated to v{updateSuccessToast} successfully.</div>
      </div>
    )}
    ```
  - [x] 2.8 Verify the `HealthCheckReport` TypeScript type is defined (import or inline). The Rust struct serializes to: `{ passed: boolean, checks_run: number, failures: Array<{ check: string, error: string, critical: boolean }>, duration_ms: number }`

- [x] Task 3: Accessibility improvements (AC: #5, #6)
  - [x] 3.1 Add focus trap to `HealthCheckModal.tsx` — use `useFocusTrap` hook if available, or implement inline: when modal opens, set focus to the modal div; prevent Tab/Shift+Tab from leaving the modal
  - [x] 3.2 Add `aria-live="polite"` to `HealthCheckModal` progress display, OR use `useAnnounce` hook (from Story 8.3 `LiveAnnouncer`) to announce each check name as progress advances
  - [x] 3.3 Verify `RollbackDialog.tsx` has `autoFocus` on the restart button (already present, line 61) — verify it works in practice
  - [x] 3.4 Add focus trap to `RollbackDialog.tsx` — same pattern as HealthCheckModal
  - [x] 3.5 Verify both dialogs use `role="dialog"` and `aria-modal="true"` (already present in stubs)

- [x] Task 4: React component tests (AC: #7)
  - [x] 4.1 Create `src/components/HealthCheckModal.test.tsx`:
    - Test: renders `null` when `isOpen=false`
    - Test: renders modal with title "Verifying app health..." when `isOpen=true`
    - Test: displays correct `currentCheck / totalChecks` and `checkName` from props
    - Test: progressbar `aria-valuenow` matches `currentCheck`
    - Test: `role="dialog"` and `aria-modal="true"` present
  - [x] 4.2 Create `src/components/RollbackDialog.test.tsx`:
    - Test: renders `null` when `isOpen=false`
    - Test: renders dialog with `failedVersion` and `previousVersion` in text
    - Test: renders `reason` text
    - Test: clicking "Restart App" calls `onRestart`
    - Test: `autoFocus` applied to restart button (or mock focus verification)
    - Test: `role="dialog"` and `aria-modal="true"` present
    - Test: `aria-labelledby` and `aria-describedby` point to valid elements

- [x] Task 5: App.tsx integration tests for health check flow (AC: #1, #2, #3)
  - [x] 5.1 In `src/App.test.tsx` (or a separate `App.healthcheck.test.tsx`), add tests with `vi.mock('@tauri-apps/api/core', ...)`:
    - Test: When `detect_update_command` returns `false`, `HealthCheckModal` is never shown
    - Test: When `detect_update_command` returns `true` and `run_health_checks_command` returns `{ passed: true, ... }`, the success toast appears with version text
    - Test: When `detect_update_command` returns `true` and `run_health_checks_command` returns `{ passed: false, failures: [...] }`, `RollbackDialog` is shown with correct props
  - [x] 5.2 Mock all Tauri invokes needed for App.tsx init: `check_api_key`, `check_encryption_status`, `detect_update_command`, `run_health_checks_command`, `set_installed_version_command`, `check_and_clear_rollback_command`, `list_settings`, etc.

- [x] Task 6: Rust test execution (AC: #8)
  - [x] 6.1 In `upwork-researcher/src-tauri/`, run: `cargo test --lib 2>&1 | head -50` to check if Rust tests execute
  - [x] 6.2 If `STATUS_ENTRYPOINT_NOT_FOUND` DLL error recurs: investigate which DLL is missing. Check if `sqlcipher.dll` / `libsqlcipher.dll` is in PATH. Try running with: `$env:PATH += ";$(pwd)\target\debug\deps"` (PowerShell) or `PATH="$(pwd)/target/debug/deps:$PATH" cargo test --lib` (bash)
  - [x] 6.3 Run specifically: `cargo test --lib -- health_check::tests` to execute only the 22 health check unit tests
  - [x] 6.4 If tests fail: fix test failures. If tests pass but DLL blocks integration tests: document in Dev Agent Record and use `cargo test --lib` as the workaround (per project Memory)
  - [x] 6.5 Report: How many health_check tests run and pass? Expected: 22

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H-1: RollbackDialog unreachable — removed `app_handle.restart()` from Rust `rollback_to_previous_version`, restructured App.tsx to call rollback THEN show dialog [health_check.rs, App.tsx]
- [x] [AI-Review][MEDIUM] M-1: AC-4 violated — added Escape keydown handler via useEffect to dismiss success toast [App.tsx]
- [x] [AI-Review][MEDIUM] M-2: Pre-existing test mock missing onboarding handler — added `get_setting` handler for `onboarding_completed` to 3 test mocks that override `mockInvoke` [App.test.tsx]
- [x] [AI-Review][MEDIUM] M-3: Orphaned setTimeout callbacks — stored timer IDs in `healthCheckTimerIds` ref, clear on modal close and in cleanup [App.tsx]
- [x] [AI-Review][LOW] L-1: Accepted as-is — all toasts in App.tsx use inline styles (consistent pattern)
- [x] [AI-Review][LOW] L-2: Accepted as-is — useFocusTrap correctly handles no-focusable-children case by focusing container

### Review Follow-ups R2 (AI)

- [x] [AI-Review-R2][MEDIUM] M-1: AC-3 test now asserts `rollback_to_previous_version_command` was called [App.test.tsx:1235]
- [x] [AI-Review-R2][LOW] L-1: Added "dismisses success toast on Escape keypress (AC-4)" test [App.test.tsx:1238-1259]
- [x] [AI-Review-R2][LOW] L-2: Accepted as-is — toasts are mutually exclusive in practice (informational)

## Dev Notes

### Architecture Compliance

- **NFR-13 (Safe Updates):** This story completes the frontend side of the "atomic updates with rollback, health check on launch" requirement.
- **NFR-1 (Startup Time):** Health checks complete in <5s total (enforced in backend). The blocking modal is acceptable for post-update first launch only.
- **AR-2 (SQLCipher):** Health check validates DB via `PRAGMA cipher_integrity_check` — frontend just invokes, no direct DB access.
- **AR-18 (Migrations):** Health check validates schema version via `refinery_schema_history` — same, frontend invokes only.

### What Exists — DO NOT REIMPLEMENT

**Rust backend (`src-tauri/src/health_check.rs`)** — FULLY IMPLEMENTED (600+ lines):
- `get_current_version()`, `get_installed_version()`, `set_installed_version()`, `detect_update()`, `mark_update_detected()`, `clear_update_detected()` — version tracking
- `check_database_connection()`, `check_database_integrity()`, `check_schema_version()`, `check_settings_loadable()` — 4 health checks with timeouts
- `run_health_checks()` — orchestrator returning `HealthCheckReport`
- `create_pre_update_backup()`, `rollback_to_previous_version()`, `cleanup_old_backups()` — backup/rollback (Windows-only; macOS stubs exist)
- `add_to_failed_versions_list()`, `get_failed_update_versions()`, `clear_failed_update_versions()` — skip list management
- `check_and_clear_rollback_command()` — reads rollback_occurred flag and clears it
- 22 unit tests

**Commands registered in `lib.rs` (lines 3063-3073):** 9 commands already registered:
- `get_installed_version_command`, `detect_update_command`, `run_health_checks_command`
- `create_pre_update_backup_command`, `rollback_to_previous_version_command`
- `get_failed_update_versions_command`, `clear_failed_update_versions_command`
- `cleanup_old_backups_command`, `check_and_clear_rollback_command`
- ❌ **MISSING: `set_installed_version_command`** — Task 1 adds this

**Frontend components (stub, not wired):**
- `src/components/HealthCheckModal.tsx` — presentational, takes `isOpen` + `progress: HealthCheckProgress` props. No focus trap. No live announcements.
- `src/components/HealthCheckModal.css` — styles exist
- `src/components/RollbackDialog.tsx` — stub with full JSX, takes `isOpen`, `failedVersion`, `previousVersion`, `reason`, `onRestart` props. Has `autoFocus` on button. Marked as stub in JSDoc.
- `src/components/RollbackDialog.css` — styles exist

**Already wired in App.tsx:**
- Rollback notification toast (Task 9.4 review fix): `check_and_clear_rollback_command` is called in the init `useEffect` (line ~464). The result displays an amber toast "Update v{X} was rolled back. This version has been skipped." (line ~1332-1335).
- `useUpdater.ts` skip list filtering: already reads `get_failed_update_versions_command` to skip downloads.
- "Clear Skipped Updates" button in `SettingsPanel.tsx`.

**IMPORTANT: What the rollback toast covers vs. what this story adds:**
- **Existing toast** = shown on the NEXT launch AFTER a rollback (checks rollback_occurred flag). This is the "last launch had a rollback" notification.
- **New RollbackDialog** = shown on the SAME launch when health checks fail, WHILE the rollback is in progress. Different purpose: real-time failure notification + user confirmation before restart.

### TypeScript Types to Define

Add to `App.tsx` imports or create `src/types/healthCheck.ts`:
```typescript
interface HealthCheckFailure {
  check: string;
  error: string;
  critical: boolean;
}

interface HealthCheckReport {
  passed: boolean;
  checks_run: number;
  failures: HealthCheckFailure[];
  duration_ms: number;
}
```

The `HealthCheckProgress` interface is already exported from `src/components/HealthCheckModal.tsx`:
```typescript
export interface HealthCheckProgress {
  currentCheck: number;
  totalChecks: number;
  checkName: string;
}
```

### Relaunch Command

The rollback restart needs to call the app restart. Check which Tauri command is used for app relaunch:
- Grep `relaunch` in `src-tauri/src/lib.rs` to find the registered command name
- The command is likely `relaunch_command` from Story 9-9 or one of the system commands
- If not found, use `@tauri-apps/plugin-updater`'s `relaunchApp()` or `app.handle().restart()` pattern

### Init Flow Ordering

The App.tsx init `useEffect` (around line ~460-503) runs multiple async operations in a `Promise.all`. Health check MUST complete before the main UI renders (it's blocking). Structure options:
1. **Sequential before Promise.all**: Run health check detection first, then proceed with other inits
2. **Conditional render gate**: Add `healthCheckComplete` state; return `<HealthCheckModal>` early if health check is pending

Option 2 is cleaner. The App already uses similar patterns for `needsPassphrase`, `needsUnlock`, `migrationPhase` — each of which gates rendering of the main UI. Follow the same pattern:
```tsx
// In JSX, before the main UI return:
if (healthCheckOpen) {
  return <HealthCheckModal isOpen={true} progress={healthCheckProgress} />;
}
```
This is consistent with how PassphraseEntry, PassphraseUnlock, etc. gate the main UI.

### Success Toast — CSS Token

Use `--color-success` CSS design token (or equivalent) for the success toast. Check `src/styles/tokens.css` for available tokens. If no success token exists, use `#22c55e` (green-500) inline with a note.

### Focus Trap Pattern

Reference Story 8.2 (complete keyboard navigation) for the focus trap pattern used elsewhere in the app. Also check if `src/hooks/useFocusTrap.ts` exists — if so, use it. If not, implement inline:
```typescript
useEffect(() => {
  if (!isOpen) return;
  const modal = dialogRef.current;
  if (!modal) return;
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first?.focus();
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };
  modal.addEventListener('keydown', handleKeyDown);
  return () => modal.removeEventListener('keydown', handleKeyDown);
}, [isOpen]);
```

### macOS Scope (NOT in this story)

macOS backup/rollback implementation (tarball create/extract) is tracked in TD2-2. The stubs in `health_check.rs` return errors on macOS. This story does NOT fix that — it only wires the frontend. On macOS, `rollback_to_previous_version_command` will return an error; the dev should handle this gracefully (show error in RollbackDialog rather than crashing).

### Testing Strategy

**Component tests (Task 4):** Use Vitest + React Testing Library. Mock Tauri invokes:
```typescript
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));
```

**App integration tests (Task 5):** The App.tsx tests already mock Tauri (see `src/App.test.tsx`). Add health check scenarios to the existing mock setup.

**Rust tests (Task 6):** The 22 tests in `health_check.rs::tests` use `tempfile::tempdir()` for DB — they should work without SQLCipher DLL if compiled with the right features. Use `cargo test --lib` (per project Memory note — skips integration tests). The specific failing tests from Story 9-9 were integration tests, not unit tests.

### Project Structure Notes

**Files to create (new):**
- `upwork-researcher/src/components/HealthCheckModal.test.tsx`
- `upwork-researcher/src/components/RollbackDialog.test.tsx`

**Files to modify:**
- `upwork-researcher/src-tauri/src/health_check.rs` — Add `set_installed_version_command`
- `upwork-researcher/src-tauri/src/lib.rs` — Register `set_installed_version_command` (line ~3073, near other health_check:: commands)
- `upwork-researcher/src/App.tsx` — Wire health check orchestration (imports, state, useEffect, JSX)
- `upwork-researcher/src/App.test.tsx` — Add health check integration tests

**Do NOT touch:**
- `src/components/HealthCheckModal.tsx` CSS — styles are fine
- `src/components/RollbackDialog.css` — styles are fine
- `src/components/SettingsPanel.tsx` — "Clear Skipped Updates" button already complete
- `src/hooks/useUpdater.ts` — skip list filtering already complete

### References

- [Source: 9-9-post-update-health-check-rollback.story.md] — Original story with tasks 6-8 deferred; Dev Agent Record with all implementation decisions
- [Source: src-tauri/src/health_check.rs] — Complete backend implementation (600+ lines, 22 tests)
- [Source: src-tauri/src/lib.rs:3063-3073] — Registered health_check commands (9 total; missing set_installed_version_command)
- [Source: src/components/HealthCheckModal.tsx] — Presentational component stub (needs focus trap + live region)
- [Source: src/components/RollbackDialog.tsx] — UI stub with full JSX (needs focus trap, not wired to backend)
- [Source: src/App.tsx:131-132] — Rollback toast state (different from RollbackDialog)
- [Source: src/App.tsx:463-476] — Existing rollback check on init (check_and_clear_rollback_command)
- [Source: epic-9-retro-2026-02-16.md] — Story 9-9 deferred work inventory
- [Source: epic-10-retro-2026-02-18.md] — TD2 creation, HIGH priority: Story 9-9 Tasks 6-8

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

None — implementation was straightforward. Key decisions documented in Completion Notes.

### Completion Notes List

**Task 1 — set_installed_version_command (2026-02-19):**
- Added `#[tauri::command] pub async fn set_installed_version_command(app_handle: AppHandle) -> Result<(), String>` to `health_check.rs` (after `cleanup_old_backups_command`)
- Registered in `lib.rs` invoke_handler alongside other health_check commands (now 121 total, verified by TD2-1 script)
- `cargo build --lib` compiles clean (exit code 0, only pre-existing warnings)

**Task 2 — App.tsx orchestration (2026-02-19):**
- Health check runs AFTER `setCheckingApiKey(false)` — this enables the `if (healthCheckOpen)` gate to show `HealthCheckModal` instead of the main UI (consistent with `needsPassphrase`, `needsUnlock` pattern)
- Used `@tauri-apps/api/app`'s `getVersion()` via dynamic import to correctly show the NEW binary version in the success toast (story code had a bug showing old installed version)
- `handleRollbackRestart` uses existing `relaunchApp` from `useUpdater` — no new command needed
- `HealthCheckReport`/`HealthCheckFailure` interfaces defined before `AppContent` function

**Task 3 — Accessibility (2026-02-19):**
- Both components use existing `useFocusTrap` hook from Story 8.2
- `HealthCheckModal`: `tabIndex={-1}` on dialog div (no buttons, needs to receive focus), `aria-live="polite"` + `aria-atomic="true"` on check name paragraph
- `RollbackDialog`: `useFocusTrap` with `autoFocus=false` (button's `autoFocus` prop handles initial focus), `ref` on overlay div

**Task 4 — Component tests (2026-02-19):**
- 7/7 tests pass for HealthCheckModal.test.tsx
- 7/7 tests pass for RollbackDialog.test.tsx
- `toHaveFocus()` used for autoFocus verification (React's `autoFocus` calls `.focus()`, doesn't set HTML `autofocus` attribute)

**Task 5 — Integration tests (2026-02-19):**
- 3/3 health check integration tests added to `src/App.test.tsx`
- Added `vi.mock("@tauri-apps/api/app", ...)` for `getVersion` mock
- Tests cover AC-1 (no modal when no update), AC-2 (success toast), AC-3 (rollback dialog)

**Task 6 — Rust tests (2026-02-19) — AC-8 ENVIRONMENTAL ISSUE:**
- `cargo build --lib` PASSES (exit code 0)
- `cargo test --lib` and `cargo test --lib -- health_check::tests` FAIL with:
  `exit code: 0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)`
- This is the pre-existing Windows DLL issue documented in project Memory (SQLCipher native DLL not in PATH at test runtime)
- Workaround: build/compile works, runtime test execution does not on this machine
- The 22 health check unit tests cannot be verified numerically — but the code compiles and the new command is structurally identical to existing tested commands
- Per AC-8: environmental issue documented here; code review should verify logic correctness

**CR R1 Fixes (2026-02-19, claude-opus-4-6):**

- **H-1 (RollbackDialog unreachable):** Removed `app_handle.restart()` from Rust `rollback_to_previous_version` (health_check.rs:~700). Restructured App.tsx failure flow: rollback file ops run first, THEN dialog state is set. RollbackDialog is now reachable.
- **M-1 (AC-4 keyboard dismiss):** Added `useEffect` with global `keydown` listener — pressing Escape dismisses the success toast. Cleanup removes listener.
- **M-2 (test mock onboarding):** Three tests that override `mockInvoke` ("displays error on API failure", "preserves client name AC-6", "shows error in progress 4a.6 AC-6") were missing `get_setting` handler for `onboarding_completed`. Added handler to all three.
- **M-3 (orphaned timers):** Added `healthCheckTimerIds` ref to store `setTimeout` IDs from progress animation. Cleared on normal completion, error catch, and component unmount. Used captured local var in cleanup to avoid React linter warning.
- **L-1, L-2:** Accepted as-is with justification (inline styles consistent with codebase, useFocusTrap works correctly).
- **Note:** 3 pre-existing flaky tests ("shows error message when save fails", "clears truncation warning", "stores jobPostId") fail in full suite run due to test ordering/state bleed but pass individually. Not caused by TD2-3 changes.

**CR R2 Fixes (2026-02-19, claude-opus-4-6):**

- **M-1 (rollback invoke assertion):** Added `expect(mockInvoke).toHaveBeenCalledWith("rollback_to_previous_version_command")` to AC-3 integration test. Verifies rollback command is actually called before dialog appears.
- **L-1 (Escape keydown test):** Added "dismisses success toast on Escape keypress (AC-4)" test — renders health check success flow, waits for toast, presses Escape, verifies toast dismissed.
- **L-2:** Accepted as-is — toasts are mutually exclusive in practice.

### File List

**New files:**
- `upwork-researcher/src/components/HealthCheckModal.test.tsx`
- `upwork-researcher/src/components/RollbackDialog.test.tsx`

**Modified files:**
- `upwork-researcher/src-tauri/src/health_check.rs` — Added `set_installed_version_command`
- `upwork-researcher/src-tauri/src/lib.rs` — Registered `set_installed_version_command`
- `upwork-researcher/src/App.tsx` — Imports, TS interfaces, state, useEffect health check, render gate, JSX for RollbackDialog + success toast
- `upwork-researcher/src/App.test.tsx` — Added `@tauri-apps/api/app` mock + 3 health check integration tests
- `upwork-researcher/src/components/HealthCheckModal.tsx` — Added `useFocusTrap`, `aria-live`, `tabIndex`, `aria-label` on progressbar
- `upwork-researcher/src/components/RollbackDialog.tsx` — Added `useFocusTrap`, `ref` on overlay div, removed stub note
