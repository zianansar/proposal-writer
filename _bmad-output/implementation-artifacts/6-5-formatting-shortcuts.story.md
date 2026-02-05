---
status: ready-for-dev
---

# Story 6.5: Formatting Shortcuts

## Story

As a freelancer,
I want keyboard shortcuts for common formatting,
So that I can edit quickly.

## Acceptance Criteria

**Given** I'm editing in TipTap
**When** I use keyboard shortcuts
**Then** the following work:

- Cmd/Ctrl + B: Bold
- Cmd/Ctrl + I: Italic
- Cmd/Ctrl + Z: Undo
- Cmd/Ctrl + Shift + Z: Redo

**And** shortcuts are shown in toolbar tooltips

## Technical Notes

- Standard rich text shortcuts
- ProseMirror handles keybindings natively
