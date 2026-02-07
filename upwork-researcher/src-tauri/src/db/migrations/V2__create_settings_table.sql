-- Settings table for app configuration (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to auto-update updated_at on changes
CREATE TRIGGER settings_updated_at
    AFTER UPDATE ON settings
    FOR EACH ROW
BEGIN
    UPDATE settings SET updated_at = datetime('now') WHERE key = NEW.key;
END;

-- Index on updated_at for sorting/querying recent changes
CREATE INDEX idx_settings_updated_at ON settings(updated_at);

-- Seed default settings (AR-18)
INSERT INTO settings (key, value) VALUES ('theme', 'dark');
INSERT INTO settings (key, value) VALUES ('api_provider', 'anthropic');
INSERT INTO settings (key, value) VALUES ('log_level', 'INFO');
INSERT INTO settings (key, value) VALUES ('safety_threshold', '180');
