---
status: ready-for-dev
---

# Story 4b.5: Weighted Job Scoring Algorithm

## Story

As a freelancer,
I want an overall job score combining multiple factors,
So that I can quickly prioritize which jobs to pursue.

## Acceptance Criteria

**Given** skills match, client quality, and budget alignment are calculated
**When** overall score is computed
**Then** the system uses weighted formula:

- Skills match: 40% weight
- Client quality: 40% weight
- Budget alignment: 20% weight

**And** final score (0-100) determines color:

- **Green:** ≥75% match AND ≥80 client score
- **Yellow:** 50-74% match OR 60-79% client score
- **Red:** <50% match OR <60% client score OR 0-hire client

**And** I see overall score with breakdown

## Technical Notes

- FR-4: weighted scoring with Green/Yellow/Red flags
- Exact thresholds from PRD
- Allows drill-down to see why job scored as it did
