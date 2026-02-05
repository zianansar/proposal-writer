---
status: ready-for-dev
---

# Story 6.1: TipTap Editor Integration

## Story

As a freelancer,
I want to edit generated proposals in a rich text editor,
So that I can refine formatting and content easily.

## Acceptance Criteria

**Given** a proposal has been generated
**When** I view the proposal
**Then** I see a TipTap rich text editor with toolbar:

- Bold, Italic
- Bullet list, Numbered list
- Clear formatting
- Undo/Redo

**And** I can edit the proposal text
**And** changes are auto-saved every 2 seconds
**And** editor loads in <100ms (NFR-4)

## Technical Notes

- AR-9: TipTap 3.x (ProseMirror-based)
- FR-8: rich text editor
- Auto-save to proposals table (updated_at timestamp)
