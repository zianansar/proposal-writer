---
status: ready-for-dev
---

# Story 5.6: Privacy Indicator: "Proposals Never Leave Your Device"

## Story

As a freelancer,
I want clear reassurance that my proposals stay private,
So that I feel comfortable uploading my best work.

## Acceptance Criteria

**Given** I'm on the Golden Set upload screen
**When** I view the page
**Then** I see a prominent indicator:

**🔒 Your proposals never leave your device**
"We analyze your writing style locally and only send statistical parameters (like tone and length) to the AI. Your actual proposal text stays on your computer."

**And** clicking "How does this work?" shows detailed explanation

## Technical Notes

- From Round 4 Red Team: change "privacy layer" to "local-only"
- Visual trust signal (lock icon, green badge)
- Clear, non-technical language
