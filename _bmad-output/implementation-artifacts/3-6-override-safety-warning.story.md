---
status: ready-for-dev
---

# Story 3.6: Override Safety Warning

## Story

As a freelancer,
I want to manually override the safety warning,
So that I can copy a proposal even if it's flagged (at my own risk).

## Acceptance Criteria

**Given** I'm on the safety warning screen
**When** I click "Override (Use at Your Own Risk)"
**Then** I see a confirmation dialog:

- "⚠️ This proposal may be detected as AI-generated."
- "Upwork may penalize your account."
- "Are you sure you want to copy it?"
- Buttons: "Cancel" | "Copy Anyway"

**And** if I confirm, the proposal is copied to clipboard
**And** override is logged for adaptive learning (Story 3.7)

## Tasks / Subtasks

- [ ] Task 1: Add override confirmation state to CopyButton (AC: 1, 2, 3)
  - [ ] 1.1: Add `showOverrideConfirm` boolean state to CopyButton
  - [ ] 1.2: Update `handleOverride` to set `showOverrideConfirm = true` instead of directly copying
  - [ ] 1.3: Keep `analysisResult` in state (don't clear) when transitioning to confirmation dialog
  - [ ] 1.4: Add `handleOverrideCancel` — sets `showOverrideConfirm = false`, returns to SafetyWarningModal
  - [ ] 1.5: Add `handleOverrideConfirm` — copies to clipboard via `writeText(text)`, logs override, clears all modal state

- [ ] Task 2: Create OverrideConfirmDialog React component (AC: 1, 2, 3)
  - [ ] 2.1: Create `OverrideConfirmDialog.tsx` in `upwork-researcher/src/components/`
  - [ ] 2.2: Accept props: `{ onCancel: () => void, onConfirm: () => void }`
  - [ ] 2.3: Display warning icon and text: "⚠️ This proposal may be detected as AI-generated."
  - [ ] 2.4: Display consequence text: "Upwork may penalize your account."
  - [ ] 2.5: Display question: "Are you sure you want to copy it?"
  - [ ] 2.6: Render buttons: "Cancel" (primary, autofocus) | "Copy Anyway" (danger)
  - [ ] 2.7: Add keyboard support: Escape → cancel, Enter → do NOT auto-confirm (safety)
  - [ ] 2.8: Add ARIA attributes: `role="alertdialog"`, `aria-modal="true"`, `aria-describedby`
  - [ ] 2.9: Style with CSS matching SafetyWarningModal dark mode theme (`#1a1a1a` bg, `#e0e0e0` text)

- [ ] Task 3: Integrate OverrideConfirmDialog into CopyButton render (AC: All)
  - [ ] 3.1: Render `OverrideConfirmDialog` when `showOverrideConfirm === true`
  - [ ] 3.2: Hide `SafetyWarningModal` when `showOverrideConfirm === true` (transition between dialogs)
  - [ ] 3.3: Wire `onCancel` to `handleOverrideCancel` (returns to SafetyWarningModal)
  - [ ] 3.4: Wire `onConfirm` to `handleOverrideConfirm` (copies + logs)
  - [ ] 3.5: Remove existing stub `console.log("Override safety warning")` from `handleOverride`

- [ ] Task 4: Implement override logging for Story 3.7 adaptive learning (AC: 5)
  - [ ] 4.1: Create `log_safety_override` Tauri command in `lib.rs`
  - [ ] 4.2: Accept `score: f32` and `threshold: f32` parameters
  - [ ] 4.3: Increment `safety_override_count` setting in DB (read current value, +1, write back)
  - [ ] 4.4: Store latest override timestamp in `safety_override_last` setting
  - [ ] 4.5: Call `log_safety_override` from `handleOverrideConfirm` in CopyButton after successful clipboard write
  - [ ] 4.6: Log override to console via `tracing::info!` for observability (Story 1-16 logging)
  - [ ] 4.7: Fire-and-forget — don't block clipboard copy on logging failure

- [ ] Task 5: Write comprehensive tests (AC: All)
  - [ ] 5.1: React test: OverrideConfirmDialog renders warning text
  - [ ] 5.2: React test: OverrideConfirmDialog renders "Cancel" and "Copy Anyway" buttons
  - [ ] 5.3: React test: Cancel button calls onCancel callback
  - [ ] 5.4: React test: Copy Anyway button calls onConfirm callback
  - [ ] 5.5: React test: Escape key calls onCancel
  - [ ] 5.6: React test: Cancel button has autofocus (safety — default action is cancel, not confirm)
  - [ ] 5.7: React test: Dialog has `role="alertdialog"` and `aria-modal="true"`
  - [ ] 5.8: CopyButton integration test: Override button shows confirmation dialog (not direct copy)
  - [ ] 5.9: CopyButton integration test: Cancel in confirmation returns to SafetyWarningModal
  - [ ] 5.10: CopyButton integration test: Confirm in confirmation copies to clipboard
  - [ ] 5.11: Rust test: `test_log_safety_override_increments_count` — count goes from 0 to 1
  - [ ] 5.12: Rust test: `test_log_safety_override_multiple` — count increments correctly across calls
  - [ ] 5.13: Rust test: `test_log_safety_override_stores_timestamp` — `safety_override_last` is set

## Dev Notes

### Architecture Context

**AR-19:** Pre-Submission Safety Scanner — override capability for edge cases
**FR-11:** AI Detection Pre-flight Scan — user override with consequences warning
**Round 3 User Persona:** Override capability for edge cases, not encouraged but available
**UX-1:** Dark mode default theme for all dialogs

### Implementation Details

**1. CopyButton State Machine (Updated)**

Current flow (Story 3.2):
```
User clicks Copy → analyze_perplexity → score ≥ threshold → SafetyWarningModal
  → "Edit Proposal" → close modal
  → "Override (Risky)" → [STUB: direct copy]
```

Updated flow (Story 3.6):
```
User clicks Copy → analyze_perplexity → score ≥ threshold → SafetyWarningModal
  → "Edit Proposal" → close modal
  → "Override (Risky)" → OverrideConfirmDialog
    → "Cancel" → back to SafetyWarningModal
    → "Copy Anyway" → writeText(text) + log_safety_override() → "Copied!"
```

**2. CopyButton State Changes**

```tsx
// NEW state
const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

// UPDATED handleOverride — now shows confirmation instead of copying
const handleOverride = useCallback(() => {
  setShowWarningModal(false);
  setShowOverrideConfirm(true);
  // Keep analysisResult — needed for logging score/threshold
}, []);

// NEW handleOverrideCancel — returns to SafetyWarningModal
const handleOverrideCancel = useCallback(() => {
  setShowOverrideConfirm(false);
  setShowWarningModal(true);
}, []);

// NEW handleOverrideConfirm — copies and logs
const handleOverrideConfirm = useCallback(async () => {
  setShowOverrideConfirm(false);

  try {
    await writeText(text);
    setCopied(true);
    setError(null);

    // Fire-and-forget override logging for Story 3.7
    if (analysisResult) {
      invoke("log_safety_override", {
        score: analysisResult.score,
        threshold: analysisResult.threshold,
      }).catch((err) => console.warn("Override logging failed:", err));
    }

    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    setError("Failed to copy to clipboard");
  }

  setAnalysisResult(null);
}, [text, analysisResult]);
```

**3. OverrideConfirmDialog Component**

```tsx
interface OverrideConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function OverrideConfirmDialog({ onCancel, onConfirm }: OverrideConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="override-confirm__backdrop" role="alertdialog" aria-modal="true" aria-describedby="override-confirm-desc">
      <div className="override-confirm">
        <p id="override-confirm-desc">
          <span aria-hidden="true">⚠️</span> This proposal may be detected as AI-generated.
        </p>
        <p>Upwork may penalize your account.</p>
        <p><strong>Are you sure you want to copy it?</strong></p>
        <div className="override-confirm__actions">
          <button className="override-confirm__button button--primary" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className="override-confirm__button button--danger" onClick={onConfirm}>
            Copy Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
```

**4. CopyButton Render Update**

```tsx
return (
  <>
    {/* ... existing button JSX ... */}

    {/* Story 3.2: Safety Warning Modal */}
    {showWarningModal && analysisResult && (
      <SafetyWarningModal
        score={analysisResult.score}
        threshold={analysisResult.threshold}
        flaggedSentences={analysisResult.flaggedSentences}
        onEdit={handleEdit}
        onOverride={handleOverride}
      />
    )}

    {/* Story 3.6: Override Confirmation Dialog */}
    {showOverrideConfirm && (
      <OverrideConfirmDialog
        onCancel={handleOverrideCancel}
        onConfirm={handleOverrideConfirm}
      />
    )}
  </>
);
```

**5. Override Logging (Rust Backend)**

Uses the existing `settings` key-value table (no new migration needed):

```rust
#[tauri::command]
async fn log_safety_override(
    score: f32,
    threshold: f32,
    database: State<'_, db::Database>,
) -> Result<(), String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;

    // Increment override count
    let current_count: i32 = match db::queries::settings::get_setting(&conn, "safety_override_count") {
        Ok(Some(val)) => val.parse().unwrap_or(0),
        _ => 0,
    };
    db::queries::settings::set_setting(&conn, "safety_override_count", &(current_count + 1).to_string())
        .map_err(|e| e.to_string())?;

    // Store last override timestamp
    let now = chrono::Utc::now().to_rfc3339();
    db::queries::settings::set_setting(&conn, "safety_override_last", &now)
        .map_err(|e| e.to_string())?;

    tracing::info!(
        score = score,
        threshold = threshold,
        override_count = current_count + 1,
        "Safety override logged"
    );

    Ok(())
}
```

**Note on `chrono`:** Check if `chrono` is already in `Cargo.toml`. If not, use SQLite's `datetime('now')` via a raw query to avoid adding a dependency, or use `std::time::SystemTime` formatted manually.

### Previous Story Intelligence

**From Story 3.2 (Safety Warning Screen — In Review):**
- `SafetyWarningModal.tsx` renders "Override (Risky)" button calling `onOverride` callback
- `CopyButton.tsx` wires `handleOverride` to the modal — currently **stubbed** with `console.log` + direct `writeText`
- `analysisResult` state holds `PerplexityAnalysis` (score, threshold, flaggedSentences)
- Modal hides when `showWarningModal` is set to `false`
- Keyboard: Escape → calls `onEdit` (close modal)
- Story 3.2 has **open code review findings** (C1-C3, H1-H4, M1-M3) — this story should avoid conflicts with those fixes

**From Story 3.5 (Safety Threshold Configuration — Ready for Dev):**
- Will make threshold configurable (140-220 slider in Settings)
- Will add `get_safety_threshold` Tauri command
- Will update `analyze_perplexity` to accept dynamic threshold
- Story 3.6 does NOT depend on 3.5 — works with hardcoded 180 or dynamic threshold

**From Story 1.8 (Settings Table — Done):**
- `settings` table: `(key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP)`
- `get_setting(conn, key)` → `Result<Option<String>, Error>`
- `set_setting(conn, key, value)` → upsert (INSERT OR REPLACE)
- <50ms save performance (NFR-4)

**From Story 1.16 (Logging Infrastructure — Done):**
- `tracing` crate configured with structured logging
- Use `tracing::info!` for override events

**Files Modified in Related Stories:**
- `upwork-researcher/src/components/CopyButton.tsx` (3.1, 3.2)
- `upwork-researcher/src/components/SafetyWarningModal.tsx` (3.2)
- `upwork-researcher/src/components/SafetyWarningModal.css` (3.2)
- `upwork-researcher/src-tauri/src/lib.rs` (3.1, 3.2)
- `upwork-researcher/src-tauri/src/claude.rs` (3.1, 3.2)
- `upwork-researcher/src-tauri/src/db/queries/settings.rs` (1.8)

### Codebase Snapshot

**CopyButton.tsx current state (key lines):**
- Lines 92-112: `handleOverride` is **stubbed** — closes modal, calls `writeText` directly, no confirmation
- Lines 25-27: `showWarningModal` and `analysisResult` state already exist
- Lines 161-169: SafetyWarningModal render with `onOverride={handleOverride}`
- Clipboard: `writeText` from `@tauri-apps/plugin-clipboard-manager` (line 2)

**SafetyWarningModal.tsx current state:**
- Line 87-90: "Override (Risky)" button calls `onOverride()` directly
- Component is self-contained, no changes needed for Story 3.6

**Database migrations:** V1-V4 exist. No new migration needed — override count stored in existing `settings` table.

**Tauri commands in lib.rs:**
- `analyze_perplexity` (line 61) — already exists
- `log_safety_override` — **does not exist yet**, needs to be added and registered in `invoke_handler`

### Git Intelligence

**Recent Patterns (from git history):**
- **Component Style:** Separate `.css` files for modals (see SafetyWarningModal.css)
- **Callbacks:** `useCallback` with dependency arrays, fire-and-forget for non-critical operations
- **Error Handling:** Graceful degradation, never block user on API/logging errors
- **Tauri Commands:** Register in `invoke_handler` array, use `State<>` for DB access
- **Testing:** Every component has `.test.tsx`, red-green-refactor approach

### Testing Requirements

**React Tests (10 minimum):**
1. `OverrideConfirmDialog renders warning text` — all three AC paragraphs present
2. `OverrideConfirmDialog renders Cancel and Copy Anyway buttons` — both buttons exist
3. `Cancel button calls onCancel` — click event triggers callback
4. `Copy Anyway button calls onConfirm` — click event triggers callback
5. `Escape key calls onCancel` — keyboard accessibility
6. `Cancel button has autofocus` — safety default (prevent accidental confirm)
7. `dialog has alertdialog role` — ARIA accessibility
8. `CopyButton: Override shows confirmation dialog` — clicking Override in SafetyWarningModal shows OverrideConfirmDialog
9. `CopyButton: Cancel in confirmation returns to safety warning` — Cancel navigates back
10. `CopyButton: Confirm copies to clipboard` — Copy Anyway calls writeText

**Rust Tests (3 minimum):**
1. `test_log_safety_override_increments_count` — count 0 → 1
2. `test_log_safety_override_multiple` — count increments correctly across calls
3. `test_log_safety_override_stores_timestamp` — `safety_override_last` setting has value

**Definition of Done:**
- All tasks/subtasks marked complete
- All React tests pass (existing + new)
- All Rust tests pass (existing + new)
- Override button in SafetyWarningModal shows confirmation dialog (not direct copy)
- Confirmation dialog displays exact AC text
- Cancel returns to SafetyWarningModal
- Copy Anyway copies to clipboard
- Override count persisted in settings table for Story 3.7
- No regressions in CopyButton or SafetyWarningModal functionality
- Dark mode styling consistent with existing modals

### Library & Framework Requirements

**Rust Dependencies (already in Cargo.toml):**
- `rusqlite` — Settings table queries
- `tauri` — Tauri command definitions
- `serde` — JSON serialization
- `tracing` — Structured logging

**React Dependencies (already in package.json):**
- `react` 19 — Component framework
- `@tauri-apps/api` — Tauri invoke
- `@tauri-apps/plugin-clipboard-manager` — Clipboard write
- `@testing-library/react` — Component testing
- `@testing-library/jest-dom` — Jest matchers

**No new dependencies required** — all libraries already installed.

### File Structure Requirements

**New Files:**
- `upwork-researcher/src/components/OverrideConfirmDialog.tsx` — Confirmation dialog component
- `upwork-researcher/src/components/OverrideConfirmDialog.css` — Dialog styling (dark mode)
- `upwork-researcher/src/components/OverrideConfirmDialog.test.tsx` — Component tests

**Modified Files:**
- `upwork-researcher/src/components/CopyButton.tsx` — Add confirmation state, replace stub with dialog flow, add logging call
- `upwork-researcher/src-tauri/src/lib.rs` — Add `log_safety_override` command, register in invoke_handler

**No Modified Files:**
- `SafetyWarningModal.tsx` — No changes needed, already wires onOverride correctly
- No new database migrations — uses existing settings table

### Cross-Story Dependencies

**Depends On:**
- Story 3.2 (Safety Warning Screen) — Provides SafetyWarningModal with "Override (Risky)" button stub
- Story 1.8 (Settings Table) — Provides `get_setting`/`set_setting` for override count persistence

**Enables:**
- Story 3.7 (Adaptive Threshold Learning) — Reads `safety_override_count` and `safety_override_last` settings to suggest threshold adjustments after 3+ overrides

**Independent Of:**
- Story 3.5 (Safety Threshold Configuration) — 3.6 works with hardcoded or dynamic threshold; no dependency either direction

**Blocks:**
- None

### Project Context Reference

**Component Location:** `upwork-researcher/src/components/`
**Tauri Backend:** `upwork-researcher/src-tauri/src/`
**Database Queries:** `upwork-researcher/src-tauri/src/db/queries/settings.rs`
**Types:** `upwork-researcher/src/types/perplexity.ts`
**Testing Conventions:** Red-green-refactor, comprehensive coverage, every component has `.test.tsx`
**Styling:** Dark mode default (#1a1a1a bg, #e0e0e0 text), CSS files matching SafetyWarningModal pattern
**Clipboard:** `writeText` from `@tauri-apps/plugin-clipboard-manager`

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Implementation Plan

**RED Phase:**
1. Write failing React tests for OverrideConfirmDialog component
2. Write failing CopyButton integration tests for override confirmation flow
3. Write failing Rust tests for `log_safety_override` command

**GREEN Phase:**
1. Create OverrideConfirmDialog component with AC-specified text and buttons
2. Update CopyButton: add confirmation state, replace handleOverride stub
3. Add `log_safety_override` Tauri command with settings table persistence
4. Register command in invoke_handler

**REFACTOR Phase:**
1. Ensure CSS consistency with SafetyWarningModal styling
2. Verify keyboard accessibility (Escape, Tab order)
3. Confirm fire-and-forget logging doesn't block clipboard

### Completion Notes List

(To be filled during implementation)

## File List

**New Files:**
- upwork-researcher/src/components/OverrideConfirmDialog.tsx
- upwork-researcher/src/components/OverrideConfirmDialog.css
- upwork-researcher/src/components/OverrideConfirmDialog.test.tsx

**Modified Files:**
- upwork-researcher/src/components/CopyButton.tsx
- upwork-researcher/src-tauri/src/lib.rs

## Change Log

- 2026-02-05: Comprehensive story context created by Scrum Master with full codebase analysis, implementation details, tasks breakdown, and testing requirements

## Status

Status: ready-for-dev
