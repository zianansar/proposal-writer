-- V23: Add revision_type and restored_from_id columns to proposal_revisions
-- Story 6.3: Proposal Revision History
-- Extends V8 schema to support revision types and restoration tracking

-- Add revision_type column with default and constraint
ALTER TABLE proposal_revisions ADD COLUMN revision_type TEXT NOT NULL DEFAULT 'edit'
    CHECK (revision_type IN ('generation', 'edit', 'restore'));

-- Add restored_from_id column for tracking restoration source
ALTER TABLE proposal_revisions ADD COLUMN restored_from_id INTEGER
    REFERENCES proposal_revisions(id);

-- Create index for fast history queries (newest first)
CREATE INDEX IF NOT EXISTS idx_proposal_revisions_proposal_created
    ON proposal_revisions(proposal_id, created_at DESC);

-- Backfill existing revisions as 'edit' type (already default)
UPDATE proposal_revisions SET revision_type = 'edit' WHERE revision_type IS NULL;
