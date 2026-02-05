---
status: ready-for-dev
---

# Story 5.7: Quick Calibration Alternative (5 Questions)

## Story

As a freelancer,
I want to calibrate my voice by answering questions instead of uploading proposals,
So that I can start quickly without past examples.

## Acceptance Criteria

**Given** I'm on Voice Calibration screen
**When** I click "Quick Calibration (No uploads needed)"
**Then** I answer 5 questions:

1. **Tone:** Formal / Professional / Casual / Friendly?
2. **Length:** Brief / Moderate / Detailed?
3. **Technical Depth:** Simple / Technical / Expert?
4. **Structure:** Bullet points / Paragraphs / Mixed?
5. **Call-to-Action:** Direct / Consultative / Question-based?

**And** answers are converted to voice parameters
**And** I see: "Voice calibrated! You can always upload proposals later for better accuracy."

## Technical Notes

- From Round 3 What If Scenarios: alternative for users without past work
- Maps questions to same parameters as Golden Set analysis
- Less accurate but immediate
