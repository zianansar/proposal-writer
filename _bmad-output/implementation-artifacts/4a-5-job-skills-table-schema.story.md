---
status: absorbed-by-4a-3
---

# Story 4a.5: Job Skills Table Schema

> **ABSORBED:** This story's scope (job_skills table migration) was absorbed into Story 4a-3 (Key Skills Extraction), Task 1. The V6 migration in 4a-3 creates this table with the schema below plus indexes and ON DELETE CASCADE.

## Story

As a developer,
I want a table to store job skills separately,
So that we can match skills against user profile in Epic 4b.

## Acceptance Criteria

**Given** the database exists
**When** the job_skills migration runs
**Then** a `job_skills` table is created with columns:

- id (INTEGER PRIMARY KEY)
- job_post_id (INTEGER, foreign key to job_posts)
- skill_name (TEXT NOT NULL)

**And** a many-to-many relationship allows multiple skills per job

## Technical Notes

- Normalized schema for skill matching
- Will be used in Epic 4b for scoring
