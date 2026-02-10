---
status: review
assignedTo: dev-agent
tasksCompleted: 7
testsWritten: 8
---

# Story 8.14: Disable Telemetry & Analytics

## Story

As a privacy-conscious user,
I want zero telemetry or usage tracking,
So that my proposal writing activity remains private.

## Acceptance Criteria

**Given** the app is configured
**When** I check telemetry settings
**Then** all analytics are disabled:

- No crash reporting (unless explicitly opt-in)
- No usage metrics sent
- No error reporting to external services
- No update check sends user data

**And** Settings shows: "✓ Zero Telemetry: No data sent without your permission"
**And** opt-in is available for crash reports only (explicit checkbox)

## Technical Notes

- From Round 5 Security Audit: NFR-8 zero telemetry default
- Tauri may enable telemetry by default - explicitly disable
- Opt-in crash reports acceptable, but default OFF

---

## Implementation Tasks

### Task 1: Verify Tauri 2.x Has No Hidden Telemetry
**Files:** `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`

- [x] 1.1 Audit Tauri 2.x documentation for any telemetry features
- [x] 1.2 Verify no analytics plugins are installed (check Cargo.toml dependencies)
- [x] 1.3 Confirm `tauri.conf.json` has no telemetry-related config
- [x] 1.4 Document findings in architecture.md

**Note:** Tauri 2.x does NOT have built-in telemetry (unlike Electron). This task is primarily verification.

**Cargo.toml audit checklist:**
- [x] No `sentry` or crash reporting crates
- [x] No `analytics` or `telemetry` crates
- [x] No `posthog`, `amplitude`, `mixpanel`, or similar
- [x] `tauri` features list doesn't include telemetry

---

### Task 2: Add Privacy Status Indicator to Settings UI
**File:** `src/components/SettingsPanel.tsx`

- [x] 2.1 Add new "Privacy" section to SettingsPanel
- [x] 2.2 Display static indicator: "✓ Zero Telemetry: No data sent without your permission"
- [x] 2.3 Style with green checkmark icon for visual confirmation
- [x] 2.4 Add help text explaining what this means

**Suggested UI:**
```tsx
<section className="settings-section">
  <h3>Privacy</h3>
  <div className="privacy-indicator">
    <span className="privacy-icon">✓</span>
    <span className="privacy-label">Zero Telemetry</span>
    <p className="settings-help">
      No usage data, analytics, or crash reports are sent without your permission.
      All data stays on your device.
    </p>
  </div>
</section>
```

---

### Task 3: Add Optional Crash Reporting Toggle (Opt-in)
**Files:** `src/components/SettingsPanel.tsx`, `src-tauri/src/db/queries/settings.rs`

- [x] 3.1 Add `crash_reporting_enabled` setting (default: `false`)
- [x] 3.2 Add checkbox UI with clear opt-in language
- [x] 3.3 Persist setting to database via `set_setting` command
- [x] 3.4 Show warning text: "If enabled, crash reports help improve the app but send error data externally"

**Note:** Actual crash reporting integration (Sentry, etc.) is deferred. This task only adds the opt-in toggle for future use.

**Suggested UI:**
```tsx
<div className="settings-field">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={crashReportingEnabled}
      onChange={handleCrashReportingChange}
    />
    <span>Enable crash reporting (helps improve the app)</span>
  </label>
  <p className="settings-help settings-help--warning">
    When enabled, anonymous crash data may be sent to help diagnose issues.
    Disabled by default for maximum privacy.
  </p>
</div>
```

---

### Task 4: Audit Error Logging for External Leaks
**File:** `src-tauri/src/logs/mod.rs`

- [x] 4.1 Verify `tracing` only writes to local files (not external endpoints)
- [x] 4.2 Confirm no HTTP appender or external sinks configured
- [x] 4.3 Verify error messages don't contain PII (proposal text, API keys)
- [x] 4.4 Document logging architecture in README or architecture.md

**Current logging setup (Story 1.16):**
- Uses `tracing` + `tracing-subscriber` + `tracing-appender`
- Writes to local app data directory with 7-day rotation
- No external sinks configured (verify this)

---

### Task 5: Add CSS for Privacy Indicator
**File:** `src/App.css`

- [x] 5.1 Add `.privacy-indicator` styles
- [x] 5.2 Add `.privacy-icon` with green color (#5cb85c)
- [x] 5.3 Add `.settings-help--warning` for warning text (amber color)
- [x] 5.4 Ensure dark/light mode compatibility

**Suggested CSS:**
```css
.privacy-indicator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background-color: rgba(92, 184, 92, 0.1);
  border: 1px solid rgba(92, 184, 92, 0.3);
  border-radius: 6px;
}

.privacy-icon {
  color: #5cb85c;
  font-size: 1.25rem;
  font-weight: bold;
}

.privacy-label {
  font-weight: 600;
  color: #5cb85c;
}

.settings-help--warning {
  color: #f59e0b;
}
```

---

### Task 6: Write Tests
**Files:** `src/components/SettingsPanel.test.tsx`

- [x] 6.1 Test: Privacy indicator renders with correct text
- [x] 6.2 Test: Crash reporting toggle defaults to OFF
- [x] 6.3 Test: Crash reporting toggle persists to settings store
- [x] 6.4 Test: Privacy section is visible in settings view

---

### Task 7: Documentation
**Files:** `_bmad-output/planning-artifacts/architecture.md`

- [x] 7.1 Add "Telemetry & Analytics" section documenting zero-telemetry policy
- [x] 7.2 Update Network Audit table to confirm no analytics endpoints
- [x] 7.3 Document crash reporting opt-in behavior for future implementation

---

## Validation Checklist

- [x] Settings > Privacy shows "✓ Zero Telemetry" indicator
- [x] Crash reporting checkbox exists and defaults to OFF
- [x] Network monitor shows no outbound calls except to api.anthropic.com
- [x] Cargo.toml has no analytics/telemetry dependencies
- [x] tracing logs write only to local files
- [x] Privacy indicator visible in both dark and light mode

---

## Dev Agent Record

### Implementation Plan

**Task 1:** Verified Tauri 2.x has no built-in telemetry by auditing:
- Cargo.toml dependencies (no analytics/telemetry crates)
- tauri.conf.json configuration (no telemetry config)
- Documented findings in architecture.md

**Task 2:** Added Privacy section to SettingsPanel with zero telemetry indicator

**Task 3:** Added crash reporting opt-in toggle (default OFF, persists to settings table)

**Task 4:** Audited logging infrastructure - confirmed local-only file appenders, no external sinks, PII redaction utilities exist

**Task 5:** Added CSS styles for privacy indicator with green checkmark and amber warning colors

**Task 6:** Wrote comprehensive tests (8 tests covering indicator rendering, toggle behavior, persistence, and UI layout)

**Task 7:** Updated architecture.md with Telemetry & Analytics Policy section

### Completion Notes

✅ **All acceptance criteria satisfied:**
- AC-1: No crash reporting (unless opt-in) - Crash reporting toggle exists but defaults OFF
- AC-2: No usage metrics sent - Verified no telemetry dependencies exist
- AC-3: No error reporting to external services - Logging writes to local files only
- AC-4: No update check sends user data - No auto-update configured in MVP
- AC-5: Settings shows "✓ Zero Telemetry" message - Privacy indicator added to Settings
- AC-6: Opt-in available for crash reports - Checkbox added with clear opt-in language

✅ **Tests:** 28 SettingsPanel tests passing (8 new tests for Story 8.14)

✅ **Architecture compliance:**
- AR-14: Network allowlist enforcement documented (Story 8.13)
- NFR-8: Zero telemetry default enforced
- NFR-15: Keyboard navigation supported (existing SettingsPanel infrastructure)

### Technical Decisions

1. **No backend changes required:** Leveraged existing `get_setting`/`set_setting` commands for crash_reporting_enabled toggle
2. **CSS color choices:** Used hardcoded green (#5cb85c) for success and amber (#f59e0b) for warning - universal colors that work across light/dark modes
3. **Documentation location:** Added telemetry policy to existing Network Audit section in architecture.md for discoverability
4. **Test coverage:** Focused on user-facing behavior (toggle state, persistence, UI rendering) rather than backend since no new backend code was written

---

## File List

### Frontend
- `src/components/SettingsPanel.tsx` - Added Privacy section with zero telemetry indicator and crash reporting toggle
- `src/components/SettingsPanel.test.tsx` - Added 8 tests for Privacy section
- `src/App.css` - Added privacy indicator styles (.privacy-indicator, .privacy-icon, .privacy-label, .settings-help--warning)

### Documentation
- `_bmad-output/planning-artifacts/architecture.md` - Added Telemetry & Analytics Policy section (lines 1577-1600)

### Backend
- (No changes - leveraged existing settings infrastructure)

---

## Change Log

- 2026-02-10: Story 8.14 complete. Added Privacy section to Settings with zero telemetry indicator and crash reporting opt-in toggle. Verified no telemetry dependencies in Cargo.toml and tauri.conf.json. Documented telemetry policy in architecture.md. All tests passing (28 SettingsPanel tests).
