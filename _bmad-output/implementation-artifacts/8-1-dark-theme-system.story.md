---
status: ready-for-dev
---

# Story 8.1: Dark Theme System

## Story

As a freelancer,
I want a polished dark theme with proper contrast,
So that I can work comfortably at night.

## Acceptance Criteria

**Given** the app opens
**When** I view any screen
**Then** I see a complete dark theme with:

- Background: #1a1a1a (dark gray, not pure black)
- Text: #e0e0e0 (light gray)
- Primary accent: #3b82f6 (blue)
- Success: #10b981 (green)
- Warning: #f59e0b (yellow)
- Error: #ef4444 (red)

**And** all colors meet WCAG AA contrast ratio (4.5:1 minimum)
**And** no bright white flashes anywhere

## Technical Notes

- Builds on Story 1.5 basic CSS
- CSS custom properties for theme system
- Full design system per UX-1
- Light mode toggle deferred to v1.1
