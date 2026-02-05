---
status: ready-for-dev
---

# Story 4b.7: RSS Feed Import

## Story

As a freelancer,
I want to import multiple jobs from an RSS feed,
So that I can batch-analyze opportunities.

## Acceptance Criteria

**Given** I'm on the Job Import screen
**When** I paste an Upwork RSS feed URL
**Then** the system fetches the feed
**And** extracts 10-50 job posts (depending on feed size)
**And** saves each to job_posts table with status 'pending_analysis'
**And** **returns immediately with confirmation (Round 6 Performance Profiler):** "23 jobs imported. Analysis in progress..."
**And** I can navigate away to other screens
**And** background worker processes queue sequentially at 1 job per 2 seconds
**And** I see real-time progress updates: "Analyzed 5/23 jobs..." (updates every 2 seconds)
**And** I receive notification when complete: "All 23 jobs analyzed. View queue →"

## Technical Notes

- FR-3: RSS feed batch import
- Parse standard RSS XML format
- **Round 6 Background Processing:** Import RSS → save to queue → return immediately → background worker processes queue. Prevents UI blocking for 100+ seconds.
- Rate limit: 1 analysis per 2 seconds to avoid API throttling
- Background worker uses Tauri async commands with progress events
