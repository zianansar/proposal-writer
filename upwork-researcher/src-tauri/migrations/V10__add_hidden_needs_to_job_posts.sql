-- Story 4a.4: Hidden Needs Detection
-- Add hidden_needs column to job_posts table (JSON TEXT storage)

ALTER TABLE job_posts ADD COLUMN hidden_needs TEXT;

-- JSON format: [{"need": "...", "evidence": "..."}, ...]
-- NULL = analysis not run yet
-- '[]' = no hidden needs detected
