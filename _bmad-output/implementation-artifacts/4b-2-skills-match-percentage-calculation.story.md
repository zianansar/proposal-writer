---
status: ready-for-dev
---

# Story 4b.2: Skills Match Percentage Calculation

## Story

As a freelancer,
I want to see how well my skills match the job requirements,
So that I know if this job is a good fit for me.

## Acceptance Criteria

**Given** I have configured my skills profile
**When** a job is analyzed
**Then** the system calculates skills match percentage:

- Count: skills in job that I have / total skills in job
- Example: Job requires [React, TypeScript, Testing] → I have [React, TypeScript] → 67% match

**And** displays: "Skills Match: 67%" with color:

- Green: ≥75%
- Yellow: 50-74%
- Red: <50%

## Technical Notes

- Simple intersection calculation
- Case-insensitive matching
- Part of FR-4 weighted scoring
