-- V2: Settings table
-- Epic 1 stories 1.8-1.9: Persistent configuration

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', 'dark'),
    ('api_provider', 'anthropic');
