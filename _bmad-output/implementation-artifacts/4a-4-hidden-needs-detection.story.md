---
status: ready-for-dev
---

# Story 4a.4: Hidden Needs Detection

## Story

As a freelancer,
I want the app to identify implied client priorities not explicitly stated,
So that I can address their real concerns in my proposal.

## Acceptance Criteria

**Given** job analysis is running
**When** Claude Haiku analyzes the job post
**Then** it identifies 2-3 hidden needs based on job language
**And** displays them with explanations:

- "Client is stressed → They mention 'urgent' and 'ASAP'"
- "Budget-conscious → They emphasize 'cost-effective solution'"

**And** hidden needs are saved to job_posts table (JSON field)

## Technical Notes

- FR-2: extract hidden needs (2-3 implied priorities)
- Advanced analysis requiring reasoning
- Examples help Claude identify patterns: "fast turnaround" → urgency, "proven track record" → risk-averse
- From Round 4 Thesis Defense: most valuable for high-volume users (Marcus)
