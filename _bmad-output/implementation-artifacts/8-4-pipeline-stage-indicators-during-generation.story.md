---
status: ready-for-dev
---

# Story 8.4: Pipeline Stage Indicators During Generation

## Story

As a freelancer,
I want to see what stage of generation is happening,
So that I understand the process and know it's working.

## Acceptance Criteria

**Given** I've clicked "Generate Proposal"
**When** generation is in progress
**Then** I see stage indicators:

1. "Analyzing job..." (0-1s) ⏳
2. "Selecting hook approach..." (1-2s) ⏳
3. "Loading your voice profile..." (2-3s) ⏳
4. "Generating proposal..." (3-7s) ⏳
5. "Running safety check..." (7-8s) ⏳
6. "Complete! ✓" (8s)

**And** current stage is highlighted
**And** completed stages show ✓
**And** total time <8s (NFR-6)

## Technical Notes

- UX-4: pipeline stage indicators
- Real-time updates via Tauri events
- Builds confidence and shows progress
