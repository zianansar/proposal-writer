---
status: ready-for-dev
---

# Story 4a.8: Save Job Analysis to Database

## Story

As a freelancer,
I want analyzed jobs saved to my database,
So that I can reference them later.

## Acceptance Criteria

**Given** job analysis has completed
**When** the analysis finishes
**Then** the system saves to database:

- job_posts table: id, url, raw_content, client_name, created_at
- job_skills table: extracted skills linked to job_post_id
- hidden_needs JSON field in job_posts

**And** save completes atomically in <100ms (NFR-4)
**And** I see subtle "Saved ✓" indicator

## Technical Notes

- NFR-19: atomic persistence
- All related data saved in single transaction
