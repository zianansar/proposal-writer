---
status: ready-for-dev
---

# Story 6.6: Copy Edited Proposal

## Story

As a freelancer,
I want to copy my edited proposal to clipboard,
So that I can paste it into Upwork.

## Acceptance Criteria

**Given** I've edited a proposal
**When** I click "Copy to Clipboard"
**Then** the current (edited) version is copied
**And** formatting is converted to plain text
**And** I see "Copied! ✓"
**And** safety check still runs (Epic 3 pre-flight)

## Technical Notes

- Strip HTML formatting, keep only text
- Newlines preserved for paragraphs
- Safety check applies to final edited version
