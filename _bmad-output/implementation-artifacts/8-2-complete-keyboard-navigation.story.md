---
status: ready-for-dev
---

# Story 8.2: Complete Keyboard Navigation

## Story

As a freelancer (keyboard power user),
I want to navigate the entire app with keyboard only,
So that I never have to use my mouse.

## Acceptance Criteria

**Given** I'm using the app with keyboard only
**When** I press Tab repeatedly
**Then** focus moves through all interactive elements in logical order:

1. Job input field
2. "Analyze Job" button
3. Results (if present)
4. "Generate Proposal" button
5. Editor (if present)
6. "Copy" button

**And** focus indicators are clearly visible (2px blue outline)
**And** Shift+Tab moves focus backwards
**And** Enter activates focused button
**And** Escape closes dialogs/modals

## Technical Notes

- Builds on Story 3.9 core shortcuts
- Full keyboard navigation (not just shortcuts)
- NFR-20: WCAG AA compliance
- Focus trap in modals (Esc to close, Tab stays within modal)
