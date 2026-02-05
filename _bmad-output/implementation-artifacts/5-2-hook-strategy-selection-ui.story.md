---
status: ready-for-dev
---

# Story 5.2: Hook Strategy Selection UI

## Story

As a freelancer,
I want to choose which hook strategy to use for my proposal,
So that I can match my approach to the client's needs.

## Acceptance Criteria

**Given** I'm about to generate a proposal
**When** I see the hook selection screen
**Then** I see 5 hook strategies as cards:

- Strategy name
- Brief description
- Example opening line
- "Best for: [client type]"

**And** I can select one strategy (default: Social Proof)
**And** selection is saved and used for generation

## Technical Notes

- FR-5: hook strategy selection
- Visual card interface for easy scanning
- Strategy influences generation prompt
