-- V4: Add draft status to proposals table
-- Story 1.14: Draft Recovery on Crash

-- Add status column (SQLite doesn't have ENUM, using TEXT with CHECK constraint)
ALTER TABLE proposals ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'completed'));

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
