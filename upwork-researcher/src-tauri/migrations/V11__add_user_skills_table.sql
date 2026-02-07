-- User Skills Table for Job Matching (Story 4b.1)
-- Used in weighted scoring algorithm (FR-4, Story 4b.2)

CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill TEXT NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT 0,  -- Future: mark top 3-5 skills as primary
    UNIQUE(skill COLLATE NOCASE)   -- Prevent duplicates (case-insensitive)
);

-- Index for fast case-insensitive skill lookups
CREATE INDEX idx_user_skills_skill ON user_skills(skill COLLATE NOCASE);

-- Index for sorting by recency
CREATE INDEX idx_user_skills_added_at ON user_skills(added_at DESC);
