---
status: ready-for-dev
---

# Story 8.9: Comprehensive E2E Test Suite

## Story

As a developer,
I want end-to-end tests covering full user journeys,
So that we can ship with confidence.

## Acceptance Criteria

**Given** the test suite is configured
**When** tests run
**Then** the following user journeys are covered:

**Journey 1: First-Time User**

1. Open app → onboarding
2. Enter API key
3. Quick Calibration (5 questions)
4. Paste job → analyze → generate → copy

**Journey 2: Returning User**

1. Open app → enter passphrase
2. View past proposals
3. Paste job → analyze → generate → edit → copy

**Journey 3: Golden Set Calibration**

1. Upload 3 proposals
2. Calibrate voice
3. Generate proposal → verify voice match

**Journey 4: Safety Override**

1. Generate proposal that fails safety
2. View warning
3. Override → copy

**And** tests pass on both macOS and Windows
**And** tests verify performance targets (startup <2s, generation <8s)
**And** tests verify accessibility (keyboard nav, screen reader)

## Technical Notes

- From Round 2: testing strategy
- **Round 6 Effort Estimate (Shark Tank):** 24-32 hours for complete E2E suite (setup, authoring 4 journeys, cross-platform debugging, CI integration), not 8-16 hours
- Tauri + Playwright or similar E2E framework
- Cross-platform CI testing on macOS and Windows
- Tests must be deterministic (no flakiness) to ship with confidence
