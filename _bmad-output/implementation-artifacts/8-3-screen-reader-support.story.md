---
status: ready-for-dev
---

# Story 8.3: Screen Reader Support

## Story

As a visually impaired freelancer,
I want the app to work with screen readers,
So that I can use it independently.

## Acceptance Criteria

**Given** I'm using a screen reader (VoiceOver, NVDA, JAWS)
**When** I navigate the app
**Then** all elements are announced correctly:

- Buttons announce their label and state
- Form fields announce label + type + value
- Status updates are announced via aria-live regions
- Headings create logical structure

**And** images have alt text
**And** loading states are announced
**And** error messages are associated with fields

## Technical Notes

- NFR-20: WCAG AA screen reader support
- ARIA labels on all interactive elements
- Semantic HTML (h1-h6, nav, main, article)
- Test with macOS VoiceOver and Windows NVDA
