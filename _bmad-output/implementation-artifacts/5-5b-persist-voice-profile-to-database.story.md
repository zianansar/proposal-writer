---
status: ready-for-dev
---

# Story 5.5b: Persist Voice Profile to Database

## Story

As a developer,
I want voice profile parameters saved to the database,
So that they persist across sessions and can be loaded for generation.

## Acceptance Criteria

**Given** voice calibration completes (Golden Set or Quick Calibration)
**When** parameters are extracted
**Then** they are saved to a `voice_profiles` table:

- user_id (for multi-user future support)
- tone (1-10 scale: formal to casual)
- avg_sentence_length (integer)
- structure_preference (bullets/paragraphs/mixed percentages)
- technical_depth (1-10 scale)
- updated_at (TIMESTAMP)

**And** voice profile is loaded on app startup
**And** updates when user recalibrates

## Technical Notes

- From Round 5 Thread of Thought: missing link in voice storage
- Single row per user (UPDATE on recalibration)
- Queried in Story 5.8 for generation
