---
status: ready-for-dev
---

# Story 4b.4: Budget Alignment Detection

## Story

As a freelancer,
I want to know if the job budget matches my rate expectations,
So that I don't waste time on low-budget jobs.

## Acceptance Criteria

**Given** I've configured my hourly/project rate in settings
**When** a job mentions budget
**Then** the system extracts budget from job post
**And** compares to my rate
**And** displays: "Budget Alignment: 90%" with color:

- Green: budget ≥ my rate
- Yellow: budget 70-99% of my rate
- Red: budget <70% of my rate

## Technical Notes

- Part of FR-4 weighted scoring
- Handles hourly ($50/hr) and project ($2000 fixed) budgets
- If budget not mentioned, shows "Unknown"
