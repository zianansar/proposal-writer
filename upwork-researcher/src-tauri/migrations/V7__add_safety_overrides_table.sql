-- V7: Safety overrides table for adaptive threshold learning
-- Story 3.7: Adaptive Threshold Learning from Overrides
-- Tracks per-override records for learning algorithm (replaces Story 3.6's simple counter)

CREATE TABLE IF NOT EXISTS safety_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    ai_score REAL NOT NULL,
    threshold_at_override REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | successful | unsuccessful
    user_feedback TEXT,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

-- Index for learning detection algorithm (query by status and timestamp)
-- Used by: get_successful_overrides_last_30_days(), detect_learning_opportunity()
CREATE INDEX IF NOT EXISTS idx_overrides_status_timestamp ON safety_overrides(status, timestamp);

-- Index for proposal lookup (when marking overrides as unsuccessful on proposal deletion)
CREATE INDEX IF NOT EXISTS idx_overrides_proposal_id ON safety_overrides(proposal_id);
