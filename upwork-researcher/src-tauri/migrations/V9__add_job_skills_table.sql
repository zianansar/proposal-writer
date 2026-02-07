-- Story 4a.3: Job Skills Extraction
-- Create job_skills table to store extracted skills linked to job posts

CREATE TABLE IF NOT EXISTS job_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_post_id INTEGER NOT NULL,
    skill_name TEXT NOT NULL,
    FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE
);

-- Index for retrieving skills by job post (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_job_skills_job_post_id ON job_skills(job_post_id);

-- Index for skills matching queries (Epic 4b: match user skills to job skills)
CREATE INDEX IF NOT EXISTS idx_job_skills_skill_name ON job_skills(skill_name);
