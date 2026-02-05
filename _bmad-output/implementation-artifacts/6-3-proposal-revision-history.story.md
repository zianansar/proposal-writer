---
status: ready-for-dev
---

# Story 6.3: Proposal Revision History

## Story

As a freelancer,
I want to see previous versions of a proposal,
So that I can revert if I make a mistake.

## Acceptance Criteria

**Given** I have edited a proposal multiple times
**When** I click "View History"
**Then** I see a list of revisions with timestamps
**And** I can preview each revision
**And** I can click "Restore this version"
**And** restoration creates a new revision (doesn't delete history)

## Technical Notes

- New table: proposal_revisions (proposal_id, content, created_at)
- Immutable log (never delete revisions)
- Each auto-save creates a revision
