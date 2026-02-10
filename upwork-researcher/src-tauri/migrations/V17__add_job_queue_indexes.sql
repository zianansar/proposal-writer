-- Migration: Add denormalized scoring columns and indexes for job queue
-- Story: 4b-9-job-queue-view-with-sorting
-- Purpose: Enable <500ms query performance for job queue with 100+ jobs (NFR-17)
--
-- Rationale: Denormalize scoring data from job_scores table into job_posts for fast queries.
-- Scores are updated in job_posts whenever job_scores.overall_score changes.
-- This avoids expensive JOINs on the hot path (job queue loading).

-- Add denormalized scoring columns to job_posts
ALTER TABLE job_posts ADD COLUMN job_title TEXT;
ALTER TABLE job_posts ADD COLUMN overall_score REAL;
ALTER TABLE job_posts ADD COLUMN score_color TEXT DEFAULT 'gray';
ALTER TABLE job_posts ADD COLUMN skills_match_percent INTEGER;
ALTER TABLE job_posts ADD COLUMN client_quality_percent INTEGER;

-- Index for sorting by overall score (default sort)
CREATE INDEX IF NOT EXISTS idx_job_posts_overall_score
ON job_posts(overall_score DESC);

-- Index for sorting by creation date (newest first)
-- Note: This index already exists from V3, IF NOT EXISTS prevents duplication
CREATE INDEX IF NOT EXISTS idx_job_posts_created_at
ON job_posts(created_at DESC);

-- Index for sorting by client name (A-Z)
CREATE INDEX IF NOT EXISTS idx_job_posts_client_name
ON job_posts(client_name);

-- Index for filtering by score color (green/yellow/red/gray)
CREATE INDEX IF NOT EXISTS idx_job_posts_score_color
ON job_posts(score_color);
