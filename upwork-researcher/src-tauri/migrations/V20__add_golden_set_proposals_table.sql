-- Migration V20: Add golden_set_proposals table for voice learning calibration
-- Story 5.3: Golden Set Upload UI
-- Purpose: Store 3-5 user's best past proposals locally for style analysis (Story 5-4)
-- Privacy: This data NEVER leaves the device - only analyzed locally

CREATE TABLE IF NOT EXISTS golden_set_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,                           -- Full proposal text (stays local)
    word_count INTEGER NOT NULL,                     -- Pre-calculated for display
    source_filename TEXT,                            -- Optional: original filename if uploaded
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient retrieval (most recent first)
CREATE INDEX IF NOT EXISTS idx_golden_set_created_at
ON golden_set_proposals(created_at DESC);
