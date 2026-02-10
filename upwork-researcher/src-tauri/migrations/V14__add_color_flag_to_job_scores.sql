-- Story 4b.5: Add color flag column to job_scores table
--
-- Color flag represents visual classification (green/yellow/red/gray) based on
-- component thresholds, separate from the weighted overall_score used for sorting.
--
-- Default 'gray' used for jobs without skills match baseline.

ALTER TABLE job_scores ADD COLUMN color_flag TEXT DEFAULT 'gray';

-- Index for filtering/grouping by color flag (e.g., "show me all red-flagged jobs")
CREATE INDEX idx_job_scores_color_flag ON job_scores(color_flag);
