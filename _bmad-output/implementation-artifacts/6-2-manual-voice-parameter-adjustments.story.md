---
status: ready-for-dev
---

# Story 6.2: Manual Voice Parameter Adjustments

## Story

As a freelancer,
I want to manually adjust voice settings,
So that future proposals better match my style.

## Acceptance Criteria

**Given** I'm in Settings → Voice
**When** I view voice settings
**Then** I see sliders for:

- Tone: Formal ←→ Casual (1-10 scale)
- Length: Brief ←→ Detailed (1-10 scale)
- Technical Depth: Simple ←→ Expert (1-10 scale)

**And** adjusting a slider immediately saves
**And** I see: "Changes will affect future proposals"
**And** current values are shown (e.g., Tone: 7/10 Professional)

## Technical Notes

- FR-10: voice weight updates (manual only in MVP)
- AR-22: MVP = few-shot prompting, NO automated learning
- Simplified from original FR-9/FR-10 scope per Round 3
