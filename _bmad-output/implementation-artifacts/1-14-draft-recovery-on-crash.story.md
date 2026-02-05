---
status: ready-for-dev
---

# Story 1.14: Draft Recovery on Crash

## Story

As a freelancer,
I want my in-progress proposals saved automatically,
So that I don't lose work if the app crashes.

## Acceptance Criteria

**Given** proposal generation is in progress
**When** the app crashes or is force-closed
**Then** on restart, I see: "Draft recovered from previous session"
**And** the last generated text is restored
**And** I can continue editing or regenerate

## Technical Notes

- NFR-11: draft recovery - atomic persistence, state saved on every generation chunk
- Save to proposals table with status: 'draft' vs 'completed'
- Stream chunks save every 50ms (AR-10 batching)
