---
status: ready-for-dev
---

# Story 5.3: Golden Set Upload UI

## Story

As a freelancer,
I want to upload 3-5 of my best past proposals,
So that the app can learn my writing style quickly.

## Acceptance Criteria

**Given** I'm in Settings → Voice Calibration
**When** I click "Upload Golden Set"
**Then** I see a file picker or text paste area
**And** I can upload/paste 3-5 past proposals
**And** I see: "Upload 3-5 of your best proposals that got responses"
**And** each proposal must be 200+ words
**And** I see count: "2/5 proposals uploaded"

## Technical Notes

- FR-16: Golden Set calibration
- Text paste OR file upload (.txt, .pdf)
- Stored in golden_set_proposals table
