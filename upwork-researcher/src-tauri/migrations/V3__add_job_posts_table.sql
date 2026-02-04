-- V3: Job Posts table
-- Epic 1 story 1.12: Store job posts for analysis before proposal generation

CREATE TABLE IF NOT EXISTS job_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    raw_content TEXT NOT NULL,
    client_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for chronological sorting (Epic 4b Story 4b-9: Job Queue View)
CREATE INDEX IF NOT EXISTS idx_job_posts_created_at ON job_posts(created_at DESC);

-- Index for duplicate detection when user adds same job twice
CREATE INDEX IF NOT EXISTS idx_job_posts_url ON job_posts(url);
