---
status: ready-for-dev
---

# Story 8.7: Memory Optimization for Large Proposal Lists

## Story

As a freelancer with 100+ proposals,
I want the app to remain fast and responsive,
So that I can access my history quickly.

## Acceptance Criteria

**Given** I have 100+ proposals in my database
**When** I view the proposal history list
**Then** the system uses virtualization (only render visible rows)
**And** scrolling is smooth (60fps)
**And** memory usage stays <300MB (NFR-2)
**And** query returns in <500ms (NFR-17)

## Technical Notes

- NFR-2: RAM target <300MB
- Virtual scrolling (react-window or similar)
- Lazy loading (load 50 at a time)
- Database indexed on created_at for fast queries
