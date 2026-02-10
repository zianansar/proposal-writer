-- Create proposals table for storing generated proposals
-- Migration V1: Initial schema

CREATE TABLE proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_content TEXT NOT NULL,
    generated_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- Index for sorting by created_at (performance optimization per architecture.md)
CREATE INDEX idx_proposals_created_at ON proposals(created_at DESC);
