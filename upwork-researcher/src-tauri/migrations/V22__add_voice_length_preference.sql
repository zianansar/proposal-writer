-- Add length_preference for manual "Brief to Detailed" slider
-- This enables users to manually adjust their preferred proposal length
-- Default 5.0 = balanced length (mid-point between brief and detailed)

ALTER TABLE voice_profiles
ADD COLUMN length_preference REAL NOT NULL DEFAULT 5.0
CHECK (length_preference >= 1 AND length_preference <= 10);
