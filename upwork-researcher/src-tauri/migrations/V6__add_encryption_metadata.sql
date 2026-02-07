-- Migration V6: Add encryption_metadata table for recovery key storage (Story 2.9)
--
-- This table stores encrypted recovery keys for database passphrase recovery.
-- Recovery keys are encrypted with the user's passphrase-derived key.
--
-- Security:
-- - recovery_key_encrypted stores the encrypted recovery key (never plaintext)
-- - created_at timestamp for audit trail
-- - Only one recovery key per database (enforced by single-row table)

CREATE TABLE encryption_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce single row
    recovery_key_encrypted TEXT,           -- Encrypted recovery key (nullable - not required)
    recovery_key_hash TEXT,                -- Argon2id hash of recovery key for verification without passphrase
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial row (recovery key can be added later via update)
INSERT INTO encryption_metadata (id, recovery_key_encrypted) VALUES (1, NULL);
