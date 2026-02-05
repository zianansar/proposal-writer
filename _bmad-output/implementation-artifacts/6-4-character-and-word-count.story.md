---
status: ready-for-dev
---

# Story 6.4: Character and Word Count

## Story

As a freelancer,
I want to see character and word counts as I edit,
So that I can match Upwork's proposal length guidelines.

## Acceptance Criteria

**Given** I'm editing a proposal
**When** I type or delete text
**Then** I see real-time counts in status bar:

- "342 characters"
- "67 words"

**And** if <200 words, shows warning: "Upwork recommends 200-500 words"
**And** if >600 words, shows warning: "Long proposals may not be fully read"

## Technical Notes

- Real-time calculation (no debounce needed for counts)
- Based on Upwork best practices
