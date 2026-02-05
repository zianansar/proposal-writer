---
status: ready-for-dev
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
