-- Voice profiles table for storing calibrated writing style parameters
-- Single row per user (UPSERT on recalibration)

CREATE TABLE voice_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default' UNIQUE,

    -- Numeric scores (1-10 scale)
    tone_score REAL NOT NULL CHECK (tone_score >= 1 AND tone_score <= 10),
    technical_depth REAL NOT NULL CHECK (technical_depth >= 1 AND technical_depth <= 10),

    -- Sentence analysis
    avg_sentence_length REAL NOT NULL CHECK (avg_sentence_length > 0),
    vocabulary_complexity REAL NOT NULL CHECK (vocabulary_complexity >= 0),

    -- Structure preference (percentages, must sum to 100)
    structure_paragraphs_pct INTEGER NOT NULL CHECK (structure_paragraphs_pct >= 0 AND structure_paragraphs_pct <= 100),
    structure_bullets_pct INTEGER NOT NULL CHECK (structure_bullets_pct >= 0 AND structure_bullets_pct <= 100),

    -- Common phrases (JSON array of strings)
    common_phrases TEXT NOT NULL DEFAULT '[]',

    -- Metadata
    sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
    calibration_source TEXT NOT NULL CHECK (calibration_source IN ('GoldenSet', 'QuickCalibration', 'Implicit')),

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast user_id lookups
CREATE INDEX idx_voice_profiles_user_id ON voice_profiles(user_id);

-- Trigger to auto-update updated_at on changes
CREATE TRIGGER voice_profiles_updated_at
    AFTER UPDATE ON voice_profiles
    FOR EACH ROW
BEGIN
    UPDATE voice_profiles SET updated_at = datetime('now') WHERE id = NEW.id;
END;
