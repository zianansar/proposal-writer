-- V8: Add proposal_revisions table for revision history
-- Story 6.3: Proposal Revision History
-- Story 6.8: Delete Proposal & All Revisions (CASCADE delete)

-- Table to store revision history for proposals
-- Each edit creates a new revision, linked to the parent proposal
CREATE TABLE IF NOT EXISTS proposal_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    revision_number INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- CASCADE: when proposal is deleted, all its revisions are automatically deleted
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Index for efficient lookup of revisions by proposal
CREATE INDEX IF NOT EXISTS idx_proposal_revisions_proposal_id
    ON proposal_revisions(proposal_id);

-- Index for ordering revisions within a proposal
CREATE INDEX IF NOT EXISTS idx_proposal_revisions_revision_number
    ON proposal_revisions(proposal_id, revision_number DESC);
