---
status: ready-for-dev
---

# Story 4b.3: Client Quality Score Estimation

## Story

As a freelancer,
I want to see an estimated client quality score,
So that I can avoid problematic clients.

## Acceptance Criteria

**Given** a job post is being analyzed
**When** Claude Haiku processes the job
**Then** it estimates client quality (0-100) based on:

- Payment history indicators ("paid on time", "verified payment")
- Hire rate signals ("0 hires" vs "100% hire rate")
- Communication quality (well-written post vs vague)

**And** displays: "Client Quality: 85%" with color:

- Green: ≥80
- Yellow: 60-79
- Red: <60 or "0 hires"

## Technical Notes

- FR-4: client quality scoring
- Inference-based (no access to real Upwork data)
- Claude analyzes job post language for signals
