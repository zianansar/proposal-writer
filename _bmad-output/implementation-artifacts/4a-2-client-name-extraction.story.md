---
status: ready-for-dev
---

# Story 4a.2: Client Name Extraction

## Story

As a freelancer,
I want the app to automatically identify the client's name from the job post,
So that I can personalize my proposal.

## Acceptance Criteria

**Given** I've pasted a job post
**When** I click "Analyze Job"
**Then** the system uses Claude Haiku to extract the client name
**And** displays: "Client: John Smith" (or "Unknown" if not found)
**And** saves client_name to job_posts table
**And** analysis completes in <3 seconds

## Technical Notes

- FR-2: extract client name
- Uses Claude Haiku for cost-effective analysis (AR-4)
- Prompt caching for analysis prompts (AR-5)
- Few-shot examples in prompt to improve accuracy
