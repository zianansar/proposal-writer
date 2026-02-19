-- Remote config cache table for storing fetched configurations
-- Migration V30: Remote config storage (Story 10.2)

CREATE TABLE remote_config (
    id INTEGER PRIMARY KEY,
    schema_version TEXT NOT NULL,
    config_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    signature TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'remote'
);
