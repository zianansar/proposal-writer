-- Budget Alignment Fields (Story 4b.4)
-- Used for weighted scoring algorithm (FR-4, Story 4b-5)

ALTER TABLE job_posts ADD COLUMN budget_min REAL;
ALTER TABLE job_posts ADD COLUMN budget_max REAL;
ALTER TABLE job_posts ADD COLUMN budget_type TEXT DEFAULT 'unknown'; -- 'hourly', 'fixed', 'unknown'
ALTER TABLE job_posts ADD COLUMN budget_alignment_pct INTEGER; -- 0-100+ or null
ALTER TABLE job_posts ADD COLUMN budget_alignment_status TEXT DEFAULT 'gray'; -- 'green', 'yellow', 'red', 'gray', 'mismatch'

-- Index for filtering jobs by budget alignment (Story 4b-9: Job Queue View)
CREATE INDEX IF NOT EXISTS idx_job_posts_budget_alignment ON job_posts(budget_alignment_status);
