---
status: ready-for-dev
---

# Story 4b.10: Report Bad Scoring Feedback Loop

## Story

As a freelancer,
I want to report when the scoring is wrong,
So that the system can improve over time.

## Acceptance Criteria

**Given** I disagree with a job's score
**When** I click "Report Incorrect Score" on a job
**Then** I see a form:

- "What's wrong with this score?"
- Checkboxes: Skills mismatch, Client quality wrong, Budget wrong, Other
- Free text field for details

**And** when I submit, feedback is logged to database
**And** I see: "Thanks! We'll use this to improve scoring."

## Technical Notes

- From Round 4 Red Team: feedback loop for bad scoring
- Data collected for future ML improvements (v1.1+)
- For now, just logged (not used to adjust scoring yet)
