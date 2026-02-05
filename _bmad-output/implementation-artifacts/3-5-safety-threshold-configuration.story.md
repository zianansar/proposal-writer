---
status: ready-for-dev
---

# Story 3.5: Safety Threshold Configuration

## Story

As a freelancer,
I want to adjust the AI detection sensitivity,
So that I can balance safety vs. strictness based on my comfort level.

## Acceptance Criteria

**Given** I'm in Settings
**When** I navigate to Safety settings
**Then** I see a slider for "AI Detection Threshold"
**And** range is 140-220 (default 180 per Round 4)
**And** slider shows labels: "Strict" (140) | "Balanced" (180) | "Permissive" (220)
**And** changing the slider immediately saves to database
**And** I see explanation: "Lower = stricter checks, Higher = more proposals pass"

## Tasks / Subtasks

- [ ] Task 1: Add Safety section to SettingsPanel (AC: 1, 2, 3, 5)
  - [ ] 1.1: Add new section "Safety" to `SettingsPanel.tsx`
  - [ ] 1.2: Create range input slider for threshold (140-220)
  - [ ] 1.3: Add labels: "Strict (140)" | "Balanced (180)" | "Permissive (220)"
  - [ ] 1.4: Display current threshold value next to slider
  - [ ] 1.5: Add help text: "Lower = stricter AI detection checks, Higher = more proposals pass"
  - [ ] 1.6: Style slider to match dark mode theme

- [ ] Task 2: Implement threshold persistence (AC: 4)
  - [ ] 2.1: Load `safety_threshold` from settings on component mount
  - [ ] 2.2: Call `set_setting("safety_threshold", value)` on slider change
  - [ ] 2.3: Add debouncing (300ms) to prevent excessive DB writes during drag
  - [ ] 2.4: Show save indicator (checkmark) after successful persist
  - [ ] 2.5: Handle save errors gracefully (show error, revert slider)

- [ ] Task 3: Add Tauri command for threshold retrieval (AC: All)
  - [ ] 3.1: Create `get_safety_threshold()` command in `lib.rs`
  - [ ] 3.2: Return default 180 if setting doesn't exist
  - [ ] 3.3: Validate returned value is in range 140-220 (sanitize if corrupted)
  - [ ] 3.4: Update `analyze_perplexity` command to use stored threshold instead of hardcoded 180

- [ ] Task 4: Integrate threshold with safety analysis (AC: All)
  - [ ] 4.1: Modify `analyze_perplexity_with_sentences()` in `claude.rs` to accept threshold parameter
  - [ ] 4.2: Update CopyButton to fetch current threshold before analysis
  - [ ] 4.3: Pass threshold to `analyze_perplexity` Tauri command
  - [ ] 4.4: Ensure SafetyWarningModal displays correct threshold value

- [ ] Task 5: Seed default threshold in database (AC: 3)
  - [ ] 5.1: Add `safety_threshold: "180"` to default settings seed in migration
  - [ ] 5.2: Verify migration includes this default (check `db/migrations/`)
  - [ ] 5.3: Add test to verify default threshold is 180 on fresh DB

- [ ] Task 6: Write comprehensive tests (AC: All)
  - [ ] 6.1: Rust test: `test_get_safety_threshold_default()` - returns 180 if not set
  - [ ] 6.2: Rust test: `test_get_safety_threshold_custom()` - returns stored value
  - [ ] 6.3: Rust test: `test_safety_threshold_validation()` - sanitizes out-of-range values
  - [ ] 6.4: Rust test: `test_analyze_perplexity_respects_threshold()` - uses custom threshold
  - [ ] 6.5: React test: Safety slider renders with correct range (140-220)
  - [ ] 6.6: React test: Slider displays default value 180 on load
  - [ ] 6.7: React test: Changing slider calls set_setting with new value
  - [ ] 6.8: React test: Labels "Strict", "Balanced", "Permissive" display correctly
  - [ ] 6.9: Integration test: Changing threshold affects CopyButton safety check

## Dev Notes

### Architecture Context

**AR-19:** Pre-Submission Safety Scanner - Configurable threshold for AI detection
**FR-11:** AI Detection Pre-flight Scan - User-configurable sensitivity
**NFR-4:** Settings persistence <50ms
**NFR-19:** Safety scanner with configurable thresholds
**Round 3 User Persona:** Configurable threshold for risk tolerance
**Round 4 Hindsight:** Default 180 (150 flagged 60% of proposals, too strict)

### Implementation Details

**1. Settings UI (React)**

Add Safety section to existing `SettingsPanel.tsx`:

```tsx
<section className="settings-section">
  <h3>Safety</h3>
  <div className="settings-field">
    <label htmlFor="safety-threshold">
      AI Detection Threshold: <strong>{threshold}</strong>
    </label>
    <input
      type="range"
      id="safety-threshold"
      min="140"
      max="220"
      step="10"
      value={threshold}
      onChange={handleThresholdChange}
      className="threshold-slider"
    />
    <div className="threshold-labels">
      <span>Strict (140)</span>
      <span>Balanced (180)</span>
      <span>Permissive (220)</span>
    </div>
    <p className="settings-help">
      Lower = stricter AI detection checks, Higher = more proposals pass
    </p>
    {saveMessage && <p className="settings-message success">✓ Saved</p>}
  </div>
</section>
```

**2. Persistence Logic**

```tsx
const [threshold, setThreshold] = useState(180);
const [saveMessage, setSaveMessage] = useState(false);
const timeoutRef = useRef<number | null>(null);

useEffect(() => {
  // Load threshold on mount
  const loadThreshold = async () => {
    try {
      const value = await invoke<number>("get_safety_threshold");
      setThreshold(value);
    } catch (err) {
      console.error("Failed to load threshold:", err);
    }
  };
  loadThreshold();
}, []);

const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const newValue = parseInt(e.target.value, 10);
  setThreshold(newValue);

  // Debounce save (300ms)
  if (timeoutRef.current) clearTimeout(timeoutRef.current);

  timeoutRef.current = window.setTimeout(async () => {
    try {
      await invoke("set_setting", {
        key: "safety_threshold",
        value: newValue.toString(),
      });
      setSaveMessage(true);
      setTimeout(() => setSaveMessage(false), 2000);
    } catch (err) {
      console.error("Failed to save threshold:", err);
      // Revert slider on error
      const current = await invoke<number>("get_safety_threshold");
      setThreshold(current);
    }
  }, 300);
};
```

**3. Rust Backend (Tauri Commands)**

Add to `lib.rs`:

```rust
#[tauri::command]
#[specta::specta]
fn get_safety_threshold(state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;

    match queries::settings::get_setting(&conn, "safety_threshold") {
        Ok(Some(value)) => {
            let threshold = value.parse::<i32>().unwrap_or(180);
            // Sanitize: ensure within valid range
            Ok(threshold.clamp(140, 220))
        }
        Ok(None) => Ok(180), // Default
        Err(e) => Err(format!("Database error: {}", e)),
    }
}
```

Update `analyze_perplexity` to accept threshold:

```rust
#[tauri::command]
#[specta::specta]
async fn analyze_perplexity(
    proposal_text: String,
    threshold: i32, // NEW PARAMETER
    state: State<'_, AppState>,
) -> Result<PerplexityAnalysis, String> {
    let api_key = state.api_key.lock().await.clone()
        .ok_or("API key not configured")?;

    claude::analyze_perplexity_with_sentences(&proposal_text, threshold, &api_key).await
}
```

Update `claude.rs` signature:

```rust
pub async fn analyze_perplexity_with_sentences(
    proposal_text: &str,
    threshold: i32, // NEW PARAMETER
    api_key: &str,
) -> Result<PerplexityAnalysis, String> {
    // ... existing implementation
    // Use `threshold` parameter instead of hardcoded 180
    Ok(PerplexityAnalysis {
        score,
        threshold, // Dynamic threshold
        flagged_sentences,
    })
}
```

**4. Integration with CopyButton**

Update `CopyButton.tsx` to fetch and pass threshold:

```tsx
const handleCopy = async () => {
  try {
    // Fetch current threshold before analysis
    const threshold = await invoke<number>("get_safety_threshold");

    const analysis = await invoke<PerplexityAnalysis>("analyze_perplexity", {
      proposalText: text,
      threshold, // Pass dynamic threshold
    });

    if (analysis.score >= analysis.threshold) {
      setShowSafetyWarning(true);
      // ... existing modal logic
    } else {
      // ... existing copy logic
    }
  } catch (error) {
    // ... existing error handling
  }
};
```

**5. Database Seeding**

Update migration to include default threshold:

```rust
// In db/migrations/ (migration file with CREATE TABLE settings)
conn.execute(
    "INSERT INTO settings (key, value, updated_at) VALUES
     ('theme', 'dark', datetime('now')),
     ('api_provider', 'anthropic', datetime('now')),
     ('safety_threshold', '180', datetime('now'))", // ADD THIS LINE
    [],
)?;
```

### Previous Story Intelligence

**From Story 1.8 (Settings Table - Completed):**
- `settings` table schema: `(key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP)`
- Key-value store pattern
- `get_setting()` and `set_setting()` functions already implemented
- Defaults seeded in migration

**From Story 1.9 (Persist User Preferences - Completed):**
- UPSERT pattern: `set_setting()` atomically inserts or updates
- <50ms save performance requirement (NFR-4)
- Settings auto-loaded on app restart

**From Story 3.2 (Safety Warning Screen - In Review):**
- `analyze_perplexity_with_sentences()` returns `PerplexityAnalysis` struct
- Current implementation uses hardcoded threshold of 180
- SafetyWarningModal displays threshold value
- CopyButton integrates safety check before clipboard write

**Files Modified in Related Stories:**
- `upwork-researcher/src-tauri/src/db/queries/settings.rs` (1.8)
- `upwork-researcher/src/components/SettingsPanel.tsx` (1.8, 1.9)
- `upwork-researcher/src-tauri/src/lib.rs` (3.2)
- `upwork-researcher/src-tauri/src/claude.rs` (3.2)
- `upwork-researcher/src/components/CopyButton.tsx` (3.2)

### Git Intelligence

**Recent Patterns (from git history):**
- **Settings Pattern:** Load on mount with `useEffect`, debounce saves, show success indicator
- **Tauri Commands:** Clamp/validate user input in Rust backend, return sanitized values
- **Error Handling:** Graceful degradation, revert UI on save failure
- **Testing:** Comprehensive coverage for settings persistence (<50ms NFR-4)

**Example Settings Component Pattern (from SettingsPanel.tsx):**
```tsx
// Load setting on mount
useEffect(() => {
  const currentLevel = getSetting("log_level") || "INFO";
  setLogLevel(currentLevel);
}, [getSetting]);

// Save with debounce and feedback
const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
  const newValue = e.target.value;
  setLocalState(newValue);

  try {
    await invoke("set_setting", { key: "setting_key", value: newValue });
    setSaveMessage("✓ Saved");
  } catch (err) {
    setSaveMessage(`Failed: ${err}`);
  }
};
```

### Testing Requirements

**Rust Tests (4 minimum):**
1. `test_get_safety_threshold_default()` - Returns 180 if not set
2. `test_get_safety_threshold_custom()` - Returns stored custom value
3. `test_safety_threshold_validation()` - Clamps out-of-range values (e.g., 250 → 220)
4. `test_analyze_perplexity_respects_custom_threshold()` - Threshold 150 vs 200 affects flagging

**React Tests (5 minimum):**
1. `renders Safety section with slider` - Slider exists with range 140-220
2. `displays default threshold 180 on load` - Initial value is 180
3. `updates slider value on change` - Local state updates immediately
4. `calls set_setting after debounce` - Verifies 300ms debounce + DB call
5. `shows success message after save` - "✓ Saved" appears after set_setting resolves

**Integration Tests (2 minimum):**
1. `changing threshold affects CopyButton safety check` - Lower threshold = more proposals blocked
2. `SafetyWarningModal displays custom threshold` - Shows "threshold: 150" when set to 150

**Definition of Done:**
- ✅ All tasks/subtasks marked complete
- ✅ All Rust tests pass (existing + new)
- ✅ All React tests pass (existing + new)
- ✅ Safety slider renders in SettingsPanel
- ✅ Threshold persists across app restarts
- ✅ CopyButton uses custom threshold for safety checks
- ✅ SafetyWarningModal displays custom threshold value
- ✅ Default threshold 180 seeded in migration
- ✅ Debouncing prevents excessive DB writes (<50ms NFR-4)

### Library & Framework Requirements

**Rust Dependencies (already in Cargo.toml):**
- `rusqlite` - Settings table queries
- `tauri` - Tauri command definitions
- `tauri-specta` - Auto-generated TypeScript types
- `serde` - JSON serialization

**React Dependencies (already in package.json):**
- `react` 19 - Component framework
- `@tauri-apps/api` - Tauri invoke
- `@testing-library/react` - Component testing

**No new dependencies required** - all libraries already installed.

### File Structure Requirements

**Modified Files:**
- `upwork-researcher/src/components/SettingsPanel.tsx` - Add Safety section with slider
- `upwork-researcher/src-tauri/src/lib.rs` - Add `get_safety_threshold` command, update `analyze_perplexity` signature
- `upwork-researcher/src-tauri/src/claude.rs` - Update `analyze_perplexity_with_sentences` to accept threshold parameter
- `upwork-researcher/src/components/CopyButton.tsx` - Fetch threshold before analysis
- `upwork-researcher/src-tauri/src/db/migrations/001_initial_schema.sql` (or equivalent) - Add safety_threshold to seed data

**Test Files:**
- `upwork-researcher/src-tauri/src/lib.rs` - Add Rust tests for `get_safety_threshold`
- `upwork-researcher/src/components/SettingsPanel.test.tsx` (create if doesn't exist) - Add slider tests

**New Files:**
- None (all changes to existing files)

### Cross-Story Dependencies

**Depends On:**
- ✅ Story 1.8 (Settings Table) - Provides settings persistence infrastructure
- ✅ Story 1.9 (Persist User Preferences) - Provides settings UI patterns
- 🔄 Story 3.2 (Safety Warning Screen) - Currently uses hardcoded threshold, needs dynamic threshold

**Enables:**
- Story 3.6 (Override Safety Warning) - Logged overrides can inform threshold recommendations
- Story 3.7 (Adaptive Threshold Learning) - Uses configurable threshold as baseline for learning

**Blocks:**
- None (can be implemented independently)

### Project Context Reference

**Component Location:** `upwork-researcher/src/components/`
**Tauri Backend:** `upwork-researcher/src-tauri/src/`
**Database Queries:** `upwork-researcher/src-tauri/src/db/queries/settings.rs`
**Migrations:** `upwork-researcher/src-tauri/src/db/migrations/`
**Testing Conventions:** Red-green-refactor, comprehensive coverage
**Styling:** Dark mode default (#1a1a1a bg, #e0e0e0 text), CSS classes matching existing patterns
**Type Safety:** Rust structs auto-generate TS types via `tauri-specta`

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Implementation Plan

**RED Phase:**
1. Write failing Rust tests for threshold retrieval and validation
2. Write failing React tests for slider component and persistence

**GREEN Phase:**
1. Add Safety section to SettingsPanel with slider UI
2. Implement `get_safety_threshold` Tauri command
3. Update `analyze_perplexity` to accept threshold parameter
4. Integrate dynamic threshold into CopyButton
5. Update database migration to seed default threshold

**REFACTOR Phase:**
1. Optimize debouncing for smooth slider interaction
2. Improve error handling for threshold save failures
3. Ensure accessibility (keyboard nav, ARIA labels)
4. Add threshold validation edge case handling

### Completion Notes List

(To be filled during implementation)

## File List

**Modified Files:**
- upwork-researcher/src/components/SettingsPanel.tsx
- upwork-researcher/src-tauri/src/lib.rs
- upwork-researcher/src-tauri/src/claude.rs
- upwork-researcher/src/components/CopyButton.tsx
- upwork-researcher/src-tauri/src/db/migrations/001_initial_schema.sql

**Test Files:**
- upwork-researcher/src-tauri/src/lib.rs (Rust tests)
- upwork-researcher/src/components/SettingsPanel.test.tsx (React tests)

## Change Log

- 2026-02-05: Story comprehensively updated by Scrum Master with full implementation context

## Status

Status: ready-for-dev
