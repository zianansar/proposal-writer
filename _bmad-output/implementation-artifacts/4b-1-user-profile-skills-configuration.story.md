---
status: ready-for-dev
---

# Story 4b.1: User Profile Skills Configuration

## Story

As a freelancer,
I want to configure my skills profile,
So that the app can match me against job requirements.

## Acceptance Criteria

**Given** I'm in Settings → Profile
**When** I enter my skills
**Then** I can add skills via autocomplete or free text
**And** skills are saved to a user_skills table (new migration)
**And** I see my current skills as removable tags
**And** changes save immediately

## Technical Notes

- Required for FR-4: weighted scoring
- Autocomplete suggests common Upwork skills
- Will be matched against job_skills in Story 4b.3
