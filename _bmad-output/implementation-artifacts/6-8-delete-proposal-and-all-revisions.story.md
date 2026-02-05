---
status: ready-for-dev
---

# Story 6.8: Delete Proposal & All Revisions

## Story

As a freelancer,
I want to permanently delete a proposal and all its revisions,
So that I can remove content I no longer want.

## Acceptance Criteria

**Given** I'm viewing a proposal
**When** I click "Delete Proposal"
**Then** I see confirmation dialog:

- "⚠️ This will permanently delete the proposal and all revisions."
- "This cannot be undone."
- Buttons: "Cancel" | "Delete Permanently"

**And** if confirmed, proposal and all revisions are hard-deleted from database
**And** I see: "Proposal deleted."

## Technical Notes

- From Round 5 Security Audit: right to deletion (GDPR-like)
- CASCADE delete on proposal_revisions
- Atomic transaction (all or nothing)
