---
status: ready-for-dev
---

# Story 4a.3: Key Skills Extraction

## Story

As a freelancer,
I want to see which skills are required for this job,
So that I can highlight relevant experience in my proposal.

## Acceptance Criteria

**Given** job analysis is running
**When** Claude Haiku processes the job post
**Then** it extracts 3-7 key skills mentioned in the post
**And** displays them as tags: [React] [TypeScript] [API Integration] [Testing]
**And** skills are saved to a job_skills table (new migration)

## Technical Notes

- FR-2: extract key skills
- Skills stored separately for future matching (Epic 4b)
- Return structured list from Claude
