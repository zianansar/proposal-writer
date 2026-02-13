-- Migration: V27 - Add proposal outcome tracking columns
-- Story: 7-1-proposal-outcome-tracking-schema
-- Purpose: Track hook strategy used, job post origin, and proposal outcomes for analytics
-- AC-1: Add outcome_status, outcome_updated_at, hook_strategy_id, job_post_id
-- AC-6: Existing rows get outcome_status='pending' via DEFAULT, nulls for other columns

-- Outcome tracking: pending → submitted → response_received/interview/hired/no_response/rejected
ALTER TABLE proposals ADD COLUMN outcome_status TEXT NOT NULL DEFAULT 'pending';

-- Timestamp for when outcome was last updated
ALTER TABLE proposals ADD COLUMN outcome_updated_at TEXT;

-- Hook strategy key used during generation (e.g., 'social_proof', 'contrarian', 'immediate_value')
ALTER TABLE proposals ADD COLUMN hook_strategy_id TEXT;

-- Foreign key reference to originating job post
ALTER TABLE proposals ADD COLUMN job_post_id INTEGER REFERENCES job_posts(id) ON DELETE SET NULL;

-- Index for filtering by outcome status (analytics, dashboard queries)
CREATE INDEX IF NOT EXISTS idx_proposals_outcome_status ON proposals(outcome_status);

-- Index for analytics grouping by hook strategy
CREATE INDEX IF NOT EXISTS idx_proposals_hook_strategy ON proposals(hook_strategy_id);

-- Index for joining proposals to job posts
CREATE INDEX IF NOT EXISTS idx_proposals_job_post_id ON proposals(job_post_id);
