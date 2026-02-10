-- Job Scores Table for Weighted Scoring (Story 4b.2, 4b.3, 4b.4, 4b.5)
-- Stores all scoring components for FR-4 weighted job scoring

CREATE TABLE IF NOT EXISTS job_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_post_id INTEGER UNIQUE NOT NULL,

    -- Individual score components (Stories 4b.2, 4b.3, 4b.4)
    skills_match_percentage REAL,           -- 0.0-100.0, Story 4b.2
    client_quality_score INTEGER,           -- 0-100, Story 4b.3
    budget_alignment_score INTEGER,         -- 0-100, Story 4b.4

    -- Combined weighted score (Story 4b.5)
    overall_score REAL,                     -- 0.0-100.0, weighted combination

    -- Metadata
    calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
);

-- Index for fast lookups by job post
CREATE INDEX idx_job_scores_job_post_id ON job_scores(job_post_id);

-- Index for sorting jobs by overall score (Story 4b.9: Job Queue View)
CREATE INDEX idx_job_scores_overall ON job_scores(overall_score DESC);
