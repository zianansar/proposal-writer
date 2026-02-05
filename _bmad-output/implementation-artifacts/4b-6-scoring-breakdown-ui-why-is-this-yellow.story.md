---
status: ready-for-dev
---

# Story 4b.6: Scoring Breakdown UI ("Why is this Yellow?")

## Story

As a freelancer,
I want to understand why a job received its color rating,
So that I can trust the scoring system.

## Acceptance Criteria

**Given** a job has been scored
**When** I click on the color flag or score
**Then** I see a detailed breakdown:

**Overall: Yellow (68%)**
**Why Yellow?**

- ✅ Skills Match: 75% (good) - You have 3/4 required skills
- ⚠️ Client Quality: 60% (medium risk) - Only 2 previous hires
- ✅ Budget: 90% (good) - $55/hr vs your $50/hr rate

**Recommendation:** Proceed with caution. Client is new to Upwork.

## Technical Notes

- From Round 3 User Persona (Marcus needs transparency)
- FR-17: rationalized scoring with human-readable explanations
- Each component shows why it scored as it did
