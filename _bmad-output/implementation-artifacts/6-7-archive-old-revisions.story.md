---
status: ready-for-dev
---

# Story 6.7: Archive Old Revisions

## Story

As a developer,
I want old revisions automatically archived,
So that the database doesn't grow unbounded.

## Acceptance Criteria

**Given** a proposal has >5 revisions (from Round 5 Occam's Razor: limit to 5)
**When** a new revision is created
**Then** the system:

1. Keeps the 5 most recent revisions
2. Archives older revisions to compressed JSON blob
3. User can still access archived revisions (read-only)

**And** active revisions table stays performant
**And** archiving happens in background (doesn't block save)

## Technical Notes

- From Round 5 Code Review: prevent 1000+ revision bloat
- Archiving after 5 revisions per Occam's Razor simplification
- Compressed storage for historical data
