---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0
testsWritten: 0
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

- [ ] 1.1 Audit Tauri 2.x documentation for any telemetry features
- [ ] 1.2 Verify no analytics plugins are installed (check Cargo.toml dependencies)
- [ ] 1.3 Confirm `tauri.conf.json` has no telemetry-related config
- [ ] 1.4 Document findings in architecture.md

**Note:** Tauri 2.x does NOT have built-in telemetry (unlike Electron). This task is primarily verification.

**Cargo.toml audit checklist:**
- [ ] No `sentry` or crash reporting crates
- [ ] No `analytics` or `telemetry` crates
- [ ] No `posthog`, `amplitude`, `mixpanel`, or similar
- [ ] `tauri` features list doesn't include telemetry

---

### Task 2: Add Privacy Status Indicator to Settings UI
**File:** `src/components/SettingsPanel.tsx`

- [ ] 2.1 Add new "Privacy" section to SettingsPanel
- [ ] 2.2 Display static indicator: "✓ Zero Telemetry: No data sent without your permission"
- [ ] 2.3 Style with green checkmark icon for visual confirmation
- [ ] 2.4 Add help text explaining what this means

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

- [ ] 3.1 Add `crash_reporting_enabled` setting (default: `false`)
- [ ] 3.2 Add checkbox UI with clear opt-in language
- [ ] 3.3 Persist setting to database via `set_setting` command
- [ ] 3.4 Show warning text: "If enabled, crash reports help improve the app but send error data externally"

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

- [ ] 4.1 Verify `tracing` only writes to local files (not external endpoints)
- [ ] 4.2 Confirm no HTTP appender or external sinks configured
- [ ] 4.3 Verify error messages don't contain PII (proposal text, API keys)
- [ ] 4.4 Document logging architecture in README or architecture.md

**Current logging setup (Story 1.16):**
- Uses `tracing` + `tracing-subscriber` + `tracing-appender`
- Writes to local app data directory with 7-day rotation
- No external sinks configured (verify this)

---

### Task 5: Add CSS for Privacy Indicator
**File:** `src/App.css`

- [ ] 5.1 Add `.privacy-indicator` styles
- [ ] 5.2 Add `.privacy-icon` with green color (#5cb85c)
- [ ] 5.3 Add `.settings-help--warning` for warning text (amber color)
- [ ] 5.4 Ensure dark/light mode compatibility

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

- [ ] 6.1 Test: Privacy indicator renders with correct text
- [ ] 6.2 Test: Crash reporting toggle defaults to OFF
- [ ] 6.3 Test: Crash reporting toggle persists to settings store
- [ ] 6.4 Test: Privacy section is visible in settings view

---

### Task 7: Documentation
**Files:** `_bmad-output/planning-artifacts/architecture.md`

- [ ] 7.1 Add "Telemetry & Analytics" section documenting zero-telemetry policy
- [ ] 7.2 Update Network Audit table to confirm no analytics endpoints
- [ ] 7.3 Document crash reporting opt-in behavior for future implementation

---

## Validation Checklist

- [ ] Settings > Privacy shows "✓ Zero Telemetry" indicator
- [ ] Crash reporting checkbox exists and defaults to OFF
- [ ] Network monitor shows no outbound calls except to api.anthropic.com
- [ ] Cargo.toml has no analytics/telemetry dependencies
- [ ] tracing logs write only to local files
- [ ] Privacy indicator visible in both dark and light mode
