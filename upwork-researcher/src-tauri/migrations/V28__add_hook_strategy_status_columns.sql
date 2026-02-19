-- Story 10.3: Dynamic Hook Strategy Updates
-- AC-1, AC-2, AC-3: Add status tracking columns for remote config sync
-- Migration V28: Add status and remote_id columns to hook_strategies table

-- Add status column with CHECK constraint to enforce valid values (active, deprecated, retired)
-- SQLite 3.25+ supports CHECK constraints in ALTER TABLE ADD COLUMN
ALTER TABLE hook_strategies ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'retired'));

-- Add remote_id column to map strategies to remote config
-- Nullable for backward compatibility with seed data (existing 5 strategies have no remote_id)
-- Note: SQLite does not support UNIQUE constraint in ALTER TABLE ADD COLUMN,
-- so uniqueness is enforced via a separate UNIQUE INDEX below.
ALTER TABLE hook_strategies ADD COLUMN remote_id TEXT;

-- Unique index on remote_id for fast lookups during sync and uniqueness enforcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_hook_strategies_remote_id ON hook_strategies(remote_id);

-- Note: Existing 5 seed strategies will have status='active' and remote_id=NULL
-- This maintains backward compatibility with Story 5.1 seed data (AC-1, AC-2)
