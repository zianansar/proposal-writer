---
status: ready-for-dev
---

# Story 5.8: Voice-Informed Proposal Generation

## Story

As a freelancer,
I want generated proposals to match my calibrated voice,
So that they sound like I wrote them.

## Acceptance Criteria

**Given** I have calibrated my voice (Golden Set or Quick Calibration)
**When** I generate a proposal
**Then** the system:

1. **Loads voice profile AND job context in parallel (Round 6 Rubber Duck clarification):**
   - Concurrent query 1: `SELECT * FROM voice_profiles WHERE user_id = ?`
   - Concurrent query 2: `SELECT * FROM job_posts JOIN job_skills WHERE job_id = ?`
   - Both complete before prompt assembly (AR-8 hybrid pipeline)
2. Assembles generation prompt combining both contexts
3. Includes voice parameters in Claude prompt:
   - "Write in a [professional] tone"
   - "Use [moderate] length sentences (avg 15 words)"
   - "Mix [paragraphs 60%] and [bullets 40%]"
   - "Technical depth: [expert level]"

**And** the generated proposal reflects these parameters
**And** before/after calibration shows noticeable difference

## Technical Notes

- AR-5: prompt caching for voice parameters
- Voice params injected into system prompt
- 30-second calibration time target (FR-16)
- From Round 5 Thread of Thought: clarified data flow
