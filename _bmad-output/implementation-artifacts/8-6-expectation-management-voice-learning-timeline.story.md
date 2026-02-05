---
status: ready-for-dev
---

# Story 8.6: Expectation Management: Voice Learning Timeline

## Story

As a new user,
I want to know how long it takes for the app to learn my voice,
So that I have realistic expectations.

## Acceptance Criteria

**Given** I'm in the onboarding flow or voice calibration
**When** I see voice learning information
**Then** I see clear messaging:

"**How Voice Learning Works:**

- First proposal: Uses your Quick Calibration or Golden Set
- After 3-5 proposals: System learns your editing patterns
- After 10+ proposals: Highly personalized to your style

Takes 3-5 uses to learn your voice."

**And** progress indicator shows: "Proposals edited: 2/5 (learning in progress)"

## Technical Notes

- UX-7: "Takes 3-5 uses to learn your voice"
- Manages expectations (not instant perfection)
- Shows progress toward calibration goal
