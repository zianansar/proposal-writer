---
status: ready-for-dev
---

# Story 4b.9: Job Queue View with Sorting

## Story

As a freelancer,
I want to see all my imported jobs in a sortable queue,
So that I can prioritize which proposals to write first.

## Acceptance Criteria

**Given** I have imported/analyzed multiple jobs
**When** I view the Job Queue
**Then** I see a list of all jobs with:

- Client name
- Skills match %
- Client quality %
- Overall score & color
- Created date

**And** I can sort by: score (default), date, client name
**And** I can filter by: Green only, Yellow+Green, All
**And** queue loads in <500ms even with 100+ jobs (NFR-17)

## Technical Notes

- UX-2: Green/Yellow/Red indicators with progressive disclosure
- Query performance critical (NFR-17)
- **Round 6 Database Index (Performance Profiler):** Create index on `overall_score` column for fast sorting: `CREATE INDEX idx_jobs_overall_score ON job_posts(overall_score DESC)`
- **Reuse virtualization pattern (Round 6):** Same react-window virtualization library used in Story 8.7 for proposal history
- Query: `SELECT id, client_name, skills_match, client_quality, overall_score, created_at FROM job_posts ORDER BY overall_score DESC LIMIT 100`
