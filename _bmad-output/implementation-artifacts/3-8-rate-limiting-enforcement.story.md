---
status: ready-for-dev
epic: 3
story: 8
dependencies:
  - 0-2-claude-api-integration-for-basic-generation
  - 0-3-streaming-ui-display
relates_to:
  - 3-3-humanization-injection-during-generation
  - 3-5-safety-threshold-configuration
---

# Story 3.8: Rate Limiting Enforcement

## Story

As a freelancer,
I want the app to prevent me from over-generating,
So that I don't burn through API credits or raise red flags.

## Acceptance Criteria

### AC1: Cooldown Timer After Generation

**Given** I have generated a proposal
**When** I try to generate another within 2 minutes
**Then** I see: "Please wait 47 seconds before generating another proposal."
**And** the "Generate" button is disabled with countdown timer
**And** after 2 minutes, the button re-enables

### AC2: Backend Enforcement

**Given** I have generated a proposal within the last 2 minutes
**When** I bypass the UI and invoke the Tauri command directly
**Then** the backend rejects the request with remaining cooldown seconds
**And** no API call is made

### AC3: Cooldown Resets on Expiry

**Given** 2 minutes have passed since my last generation
**When** I click "Generate Proposal"
**Then** the generation proceeds normally with no cooldown message

### AC4: App Restart Resets Cooldown

**Given** the app is restarted during an active cooldown
**When** I open the app and click "Generate Proposal"
**Then** the generation proceeds normally (in-memory cooldown resets)

## Technical Notes

- FR-12: cooldown max 1 generation per 2 minutes
- Backend enforcement (not just UI disable)
- Phase 2: UI controls in settings to configure cooldown duration (for now, hardcoded 120s)
- Architecture: cooldown is a **business rule** (FR-12), not generic debounce
- Architecture specifies `pipeline/mod.rs` for cooldown check — since pipeline doesn't exist yet, implement as Tauri managed state + early guard in generate commands in `lib.rs`
- Rate limit rejection returns error string with remaining seconds (current codebase uses `Result<T, String>`, not `AppError`)

## Tasks / Subtasks

- [ ] Task 1: Add cooldown state management in Rust backend (AC: 2, 3, 4)
  - [ ] 1.1: Add `CooldownState` struct with `Mutex<Option<std::time::Instant>>` for last generation timestamp
  - [ ] 1.2: Register `CooldownState` as Tauri managed state in `lib.rs` `run()` function
  - [ ] 1.3: Add `check_cooldown()` helper that returns `Ok(())` or `Err("RATE_LIMITED:47")` with remaining seconds
  - [ ] 1.4: Add `record_generation()` helper that updates the last generation timestamp
  - [ ] 1.5: Add `get_cooldown_remaining` Tauri command that returns remaining seconds (0 if no cooldown active)

- [ ] Task 2: Enforce cooldown in generate commands (AC: 2, 3)
  - [ ] 2.1: Add cooldown check as first operation in `generate_proposal_streaming` command
  - [ ] 2.2: Add cooldown check as first operation in `generate_proposal` command (non-streaming)
  - [ ] 2.3: Record generation timestamp after successful API call (not before — failed calls shouldn't trigger cooldown)
  - [ ] 2.4: Return structured error: `"RATE_LIMITED:seconds_remaining"` format for frontend parsing

- [ ] Task 3: Add cooldown state to frontend generation store (AC: 1)
  - [ ] 3.1: Add `cooldownEnd: number | null` (timestamp) to `useGenerationStore`
  - [ ] 3.2: Add `cooldownRemaining: number` (seconds) to `useGenerationStore`
  - [ ] 3.3: Add `setCooldown(durationMs: number)` action
  - [ ] 3.4: Add `clearCooldown()` action
  - [ ] 3.5: Add `tickCooldown()` action that recalculates remaining seconds from `cooldownEnd`

- [ ] Task 4: Add cooldown countdown timer in App.tsx (AC: 1, 3)
  - [ ] 4.1: After successful generation, call `setCooldown(120_000)` to start 2-minute cooldown
  - [ ] 4.2: Add `useEffect` with 1-second `setInterval` to call `tickCooldown()` while cooldown active
  - [ ] 4.3: Clear interval and call `clearCooldown()` when countdown reaches 0
  - [ ] 4.4: On generation error from backend containing "RATE_LIMITED:", parse remaining seconds and sync frontend timer
  - [ ] 4.5: Pass `cooldownRemaining` to GenerateButton

- [ ] Task 5: Update GenerateButton with cooldown display (AC: 1)
  - [ ] 5.1: Add `cooldownSeconds` prop to GenerateButton
  - [ ] 5.2: When `cooldownSeconds > 0`, disable button and show "Please wait {cooldownSeconds}s"
  - [ ] 5.3: When `cooldownSeconds === 0`, show normal "Generate Proposal" text
  - [ ] 5.4: Style countdown state distinctly from loading state (different color/opacity)

- [ ] Task 6: Sync cooldown on app startup (AC: 4)
  - [ ] 6.1: Call `get_cooldown_remaining` on app init to check if backend has active cooldown
  - [ ] 6.2: If remaining > 0, set frontend cooldown timer (handles edge case of frontend-only restart)
  - [ ] 6.3: Since backend uses in-memory state, app restart naturally clears cooldown (AC4 satisfied by design)

- [ ] Task 7: Write comprehensive tests (AC: All)
  - [ ] 7.1: Rust test: `test_cooldown_blocks_within_window()` — generation blocked within 120s
  - [ ] 7.2: Rust test: `test_cooldown_allows_after_expiry()` — generation allowed after 120s
  - [ ] 7.3: Rust test: `test_cooldown_returns_remaining_seconds()` — error contains correct remaining time
  - [ ] 7.4: Rust test: `test_cooldown_not_set_on_failed_generation()` — failed API calls don't trigger cooldown
  - [ ] 7.5: Rust test: `test_get_cooldown_remaining_no_active()` — returns 0 when no cooldown
  - [ ] 7.6: Rust test: `test_get_cooldown_remaining_active()` — returns correct remaining seconds
  - [ ] 7.7: React test: GenerateButton shows countdown text when cooldownSeconds > 0
  - [ ] 7.8: React test: GenerateButton disabled during cooldown
  - [ ] 7.9: React test: GenerateButton re-enables when cooldown reaches 0
  - [ ] 7.10: React test: Store `setCooldown` sets correct `cooldownEnd` timestamp
  - [ ] 7.11: React test: Store `tickCooldown` decrements `cooldownRemaining`
  - [ ] 7.12: React test: Backend RATE_LIMITED error parsed and syncs timer

## Dev Notes

### Architecture Context

**FR-12:** System enforces "Cool Down" (max 1 generation per 2 mins)
**Section 7.1:** Spam Protection — "Cool Down" timer prevents accidental spam-like behavior that triggers Upwork's behavioral flags
**Architecture (Command Rate Limiting):** Business-rule rate limits enforced Rust-side. UI debounce is frontend responsibility.
**Architecture (Cooldown vs rate_limiter distinction):** `rate_limiter.rs` = generic command debounce (prevents UI bugs from rapid duplicate calls). `pipeline/mod.rs` = generation cooldown business rule (FR-12). Since `pipeline/mod.rs` doesn't exist yet, implement cooldown as Tauri managed state checked in `lib.rs` generate commands.

### Implementation Details

**1. Backend Cooldown State (Rust)**

Add to `lib.rs`:

```rust
use std::time::Instant;

/// Cooldown state for generation rate limiting (FR-12)
/// In-memory only — resets on app restart (acceptable: UX protection, not security)
pub struct CooldownState {
    pub last_generation: Mutex<Option<Instant>>,
}

const COOLDOWN_SECONDS: u64 = 120; // 2 minutes (FR-12)

impl CooldownState {
    pub fn new() -> Self {
        Self {
            last_generation: Mutex::new(None),
        }
    }

    /// Check if cooldown is active. Returns remaining seconds or 0.
    pub fn remaining_seconds(&self) -> u64 {
        let guard = self.last_generation.lock().unwrap();
        match *guard {
            Some(last) => {
                let elapsed = last.elapsed().as_secs();
                if elapsed < COOLDOWN_SECONDS {
                    COOLDOWN_SECONDS - elapsed
                } else {
                    0
                }
            }
            None => 0,
        }
    }

    /// Record that a generation just completed.
    pub fn record(&self) {
        let mut guard = self.last_generation.lock().unwrap();
        *guard = Some(Instant::now());
    }
}
```

Register in `run()`:

```rust
.manage(CooldownState::new())
```

**2. Cooldown Guard in Generate Commands**

Add early guard to both generate commands:

```rust
#[tauri::command]
async fn generate_proposal_streaming(
    job_content: String,
    app_handle: AppHandle,
    config_state: State<'_, config::ConfigState>,
    database: State<'_, db::Database>,
    draft_state: State<'_, DraftState>,
    cooldown: State<'_, CooldownState>,  // NEW
) -> Result<String, String> {
    // FR-12: Check cooldown FIRST — before any API call
    let remaining = cooldown.remaining_seconds();
    if remaining > 0 {
        return Err(format!("RATE_LIMITED:{}", remaining));
    }

    // ... existing generation logic ...

    // Record successful generation timestamp (after API call succeeds)
    cooldown.record();

    Ok(result)
}
```

**3. Query Command for Frontend Sync**

```rust
#[tauri::command]
fn get_cooldown_remaining(cooldown: State<CooldownState>) -> Result<u64, String> {
    Ok(cooldown.remaining_seconds())
}
```

**4. Frontend Store Changes (useGenerationStore)**

Add cooldown fields:

```typescript
interface GenerationState {
  // ... existing fields ...
  cooldownEnd: number | null;       // Date.now() + duration when cooldown set
  cooldownRemaining: number;        // Seconds remaining (for display)
}

interface GenerationActions {
  // ... existing actions ...
  setCooldown: (durationMs: number) => void;
  clearCooldown: () => void;
  tickCooldown: () => void;
}
```

**5. App.tsx Countdown Timer**

```typescript
const { cooldownRemaining, setCooldown, tickCooldown, clearCooldown } = useGenerationStore();

// Start cooldown after successful generation
useEffect(() => {
  if (fullText && !streamError) {
    setCooldown(120_000);
  }
}, [fullText, streamError, setCooldown]);

// Countdown interval
useEffect(() => {
  if (cooldownRemaining <= 0) return;

  const interval = setInterval(() => {
    tickCooldown();
    if (useGenerationStore.getState().cooldownRemaining <= 0) {
      clearCooldown();
      clearInterval(interval);
    }
  }, 1000);

  return () => clearInterval(interval);
}, [cooldownRemaining > 0]);

// Handle RATE_LIMITED errors from backend
const handleGenerate = async () => {
  // ... existing logic ...
  try {
    await invoke("generate_proposal_streaming", { jobContent });
  } catch (err) {
    const errorMessage = String(err);
    if (errorMessage.startsWith("RATE_LIMITED:")) {
      const remaining = parseInt(errorMessage.split(":")[1], 10);
      setCooldown(remaining * 1000);
    } else {
      useGenerationStore.getState().setError(errorMessage);
    }
  }
};
```

**6. GenerateButton Update**

```tsx
interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  cooldownSeconds?: number;  // NEW
}

function GenerateButton({ onClick, disabled, loading, cooldownSeconds = 0 }: GenerateButtonProps) {
  const isCoolingDown = cooldownSeconds > 0;

  let buttonText = "Generate Proposal";
  if (loading) buttonText = "Generating...";
  else if (isCoolingDown) buttonText = `Please wait ${cooldownSeconds}s`;

  return (
    <button
      className={`generate-button ${isCoolingDown ? "cooldown" : ""}`}
      onClick={onClick}
      disabled={disabled || loading || isCoolingDown}
      type="button"
    >
      {buttonText}
    </button>
  );
}
```

### Previous Story Intelligence

**From Story 0.2 (Claude API Integration - Done):**
- `generate_proposal` command in `lib.rs` — non-streaming, kept for backwards compatibility
- Uses `Result<String, String>` error pattern

**From Story 0.3 (Streaming UI Display - Done):**
- `generate_proposal_streaming` command in `lib.rs` — primary generation path
- GenerateButton component with `disabled` and `loading` props
- `useGenerationStore` manages streaming state (tokens, isStreaming, error, fullText)

**From Story 3.3 (Humanization - In Progress):**
- Both generate commands read humanization intensity from settings
- May modify `generate_proposal_streaming` signature — coordinate to avoid conflicts

**Files Modified in Related Stories:**
- `upwork-researcher/src-tauri/src/lib.rs` (0.2, 0.3, 3.3)
- `upwork-researcher/src/components/GenerateButton.tsx` (0.3)
- `upwork-researcher/src/stores/useGenerationStore.ts` (0.3, 1.13, 1.14)
- `upwork-researcher/src/App.tsx` (0.3, 1.13, 1.14)

### Git Intelligence

**Recent Patterns (from git history):**
- **Tauri State:** Use `Mutex<T>` for shared state, register via `.manage()` in `run()`
- **Error Pattern:** `Result<T, String>` — no `AppError` struct exists yet
- **Store Pattern:** Zustand stores with clear state/action separation
- **Component Props:** Minimal, focused props — GenerateButton has only 3 props today
- **Testing:** Red-green-refactor, comprehensive coverage, every component has `.test.tsx`

### Testing Requirements

**Rust Tests (6 minimum):**
1. `test_cooldown_blocks_within_window()` — Returns error within 120s of last generation
2. `test_cooldown_allows_after_expiry()` — Allows generation after 120s
3. `test_cooldown_returns_remaining_seconds()` — Remaining time is accurate
4. `test_cooldown_not_set_on_failed_generation()` — Failed API calls don't trigger cooldown
5. `test_get_cooldown_remaining_no_active()` — Returns 0 with no prior generation
6. `test_get_cooldown_remaining_active()` — Returns correct remaining after generation

**React Tests (6 minimum):**
1. GenerateButton: Shows countdown text when cooldownSeconds > 0
2. GenerateButton: Button disabled during cooldown
3. GenerateButton: Re-enables when cooldownSeconds is 0
4. Store: `setCooldown` sets `cooldownEnd` and `cooldownRemaining`
5. Store: `tickCooldown` decrements `cooldownRemaining` correctly
6. App integration: RATE_LIMITED error from backend parsed and starts countdown

**Definition of Done:**
- All tasks/subtasks marked complete
- All Rust tests pass (existing + new)
- All React tests pass (existing + new)
- Backend rejects generation within 120s of last successful generation
- Frontend shows countdown timer on GenerateButton
- Button re-enables automatically when cooldown expires
- Failed generations do NOT trigger cooldown
- No regressions in existing generation flow
- App restart clears cooldown (in-memory state)
- Cooldown duration hardcoded (configurable settings deferred to Phase 2)

### Library & Framework Requirements

**Rust Dependencies (already in Cargo.toml):**
- `std::time::Instant` — Timestamp tracking (stdlib, no dependency)
- `std::sync::Mutex` — Thread-safe state (stdlib, no dependency)
- `tauri` — Managed state + commands
- `serde` — JSON serialization

**React Dependencies (already in package.json):**
- `zustand` — Store for cooldown state
- `react` 19 — `useEffect` for countdown interval
- `@testing-library/react` — Component testing

**No new dependencies required.**

### File Structure Requirements

**Modified Files:**
- `upwork-researcher/src-tauri/src/lib.rs` — Add `CooldownState`, cooldown guard in generate commands, `get_cooldown_remaining` command
- `upwork-researcher/src/stores/useGenerationStore.ts` — Add cooldown state fields and actions
- `upwork-researcher/src/components/GenerateButton.tsx` — Add `cooldownSeconds` prop and countdown display
- `upwork-researcher/src/App.tsx` — Add cooldown timer logic, RATE_LIMITED error handling, pass cooldownRemaining to GenerateButton

**Test Files:**
- `upwork-researcher/src-tauri/src/lib.rs` — Rust unit tests for CooldownState
- `upwork-researcher/src/components/GenerateButton.test.tsx` — Cooldown display tests
- `upwork-researcher/src/stores/useGenerationStore.test.ts` (create if doesn't exist) — Store action tests

**New Files:**
- None (all changes to existing files; CooldownState is small enough to live in `lib.rs`)

### Cross-Story Dependencies

**Depends On:**
- Story 0.2 (Claude API Integration) — Provides `generate_proposal` command
- Story 0.3 (Streaming UI Display) — Provides `generate_proposal_streaming`, GenerateButton, useGenerationStore
- Story 1.13 (API Error Handling) — Error handling patterns in App.tsx

**Potentially Conflicts With:**
- Story 3.3 (Humanization Injection) — Currently in-progress, modifies generate commands in `lib.rs`. Dev should check for merge conflicts in generate command signatures.

**Enables:**
- Phase 2: Configurable cooldown duration in settings (will extend Story 3-5 pattern)

**Blocks:**
- None

### Project Context Reference

**Component Location:** `upwork-researcher/src/components/`
**Tauri Backend:** `upwork-researcher/src-tauri/src/`
**Stores:** `upwork-researcher/src/stores/`
**Testing Conventions:** Red-green-refactor, comprehensive coverage
**Styling:** Dark mode default, CSS classes matching existing patterns
**Error Pattern:** `Result<T, String>` (no `AppError` struct yet)

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Implementation Plan

**RED Phase:**
1. Write failing Rust tests for CooldownState (blocks within window, allows after expiry)
2. Write failing React tests for GenerateButton cooldown display
3. Write failing store tests for cooldown actions

**GREEN Phase:**
1. Implement CooldownState struct and register as Tauri managed state
2. Add cooldown guard to both generate commands
3. Add `get_cooldown_remaining` command
4. Add cooldown fields/actions to useGenerationStore
5. Update GenerateButton with cooldownSeconds prop
6. Add countdown timer logic in App.tsx
7. Handle RATE_LIMITED error parsing in handleGenerate

**REFACTOR Phase:**
1. Ensure countdown timer cleanup (clearInterval on unmount)
2. Verify no race conditions between frontend timer and backend state
3. Verify failed generations don't trigger cooldown
4. Test app restart behavior

### Completion Notes List

(To be filled during implementation)

## File List

**Modified Files:**
- upwork-researcher/src-tauri/src/lib.rs
- upwork-researcher/src/stores/useGenerationStore.ts
- upwork-researcher/src/components/GenerateButton.tsx
- upwork-researcher/src/App.tsx

**Test Files:**
- upwork-researcher/src-tauri/src/lib.rs (Rust tests)
- upwork-researcher/src/components/GenerateButton.test.tsx (React tests)

## Change Log

- 2026-02-05: Comprehensive story update by Scrum Master — added full task breakdown, architecture context, implementation details, testing requirements, cross-story dependencies, and dev notes. Resolved PRD scope ambiguity (basic countdown UI in-scope, configurable settings deferred to Phase 2). Aligned with architecture's cooldown vs. rate_limiter distinction.

## Status

Status: ready-for-dev
