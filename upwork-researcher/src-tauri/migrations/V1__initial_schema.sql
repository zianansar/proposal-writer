-- V1: Initial schema - proposals table
-- Epic 1 stories 1.1-1.4: Basic data persistence

CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_content TEXT NOT NULL,
    generated_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- Index for sorting by date (Story 1.4)
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
