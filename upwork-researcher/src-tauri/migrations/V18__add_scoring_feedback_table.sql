-- Story 4b-10: Report Bad Scoring Feedback Loop
-- Add table to store user feedback when scoring is incorrect

CREATE TABLE scoring_feedback (
    id INTEGER PRIMARY KEY,
    job_post_id INTEGER NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    reported_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Snapshot of scores at report time
    overall_score_at_report REAL,
    color_flag_at_report TEXT,
    skills_match_at_report REAL,
    client_quality_at_report INTEGER,
    budget_alignment_at_report INTEGER,

    -- User feedback (boolean flags as INTEGER: 0 = false, 1 = true)
    issue_skills_mismatch INTEGER NOT NULL DEFAULT 0,
    issue_client_quality INTEGER NOT NULL DEFAULT 0,
    issue_budget_wrong INTEGER NOT NULL DEFAULT 0,
    issue_score_too_high INTEGER NOT NULL DEFAULT 0,
    issue_score_too_low INTEGER NOT NULL DEFAULT 0,
    issue_other INTEGER NOT NULL DEFAULT 0,
    user_notes TEXT,

    -- Metadata
    app_version TEXT
);

-- Index for duplicate detection and reporting queries
CREATE INDEX idx_scoring_feedback_job_reported ON scoring_feedback(job_post_id, reported_at DESC);
