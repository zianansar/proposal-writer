-- Story 4b.7: RSS Feed Import Tracking
-- Add columns to job_posts for RSS import tracking
-- Create rss_imports table for batch import metadata

-- Add source tracking to job_posts (manual vs rss)
ALTER TABLE job_posts ADD COLUMN source TEXT DEFAULT 'manual';

-- Add analysis status tracking for background processing
-- Values: 'none', 'pending_analysis', 'analyzing', 'analyzed', 'error'
ALTER TABLE job_posts ADD COLUMN analysis_status TEXT DEFAULT 'none';

-- Link to RSS import batch
ALTER TABLE job_posts ADD COLUMN import_batch_id TEXT;

-- Create rss_imports table to track batch import metadata
CREATE TABLE rss_imports (
    id INTEGER PRIMARY KEY,
    batch_id TEXT UNIQUE NOT NULL,
    feed_url TEXT NOT NULL,
    total_jobs INTEGER NOT NULL DEFAULT 0,
    analyzed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_job_posts_import_batch ON job_posts(import_batch_id);
CREATE INDEX idx_job_posts_analysis_status ON job_posts(analysis_status);
CREATE INDEX idx_rss_imports_status ON rss_imports(status);
