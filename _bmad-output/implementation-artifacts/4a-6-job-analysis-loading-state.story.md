---
status: ready-for-dev
---

# Story 4a.6: Job Analysis Loading State

## Story

As a freelancer,
I want to see progress while job analysis is running,
So that I know the app is working and not frozen.

## Acceptance Criteria

**Given** I clicked "Analyze Job"
**When** analysis is in progress
**Then** I see a progress indicator with stages:

- "Analyzing job post..." (0-2s)
- "Extracting details..." (2-3s)
- "Complete! ✓" (3s)

**And** each stage shows a subtle animation
**And** total time is <3 seconds per performance target

## Technical Notes

- UX feedback during async operation
- Real-time stage updates via Tauri events
