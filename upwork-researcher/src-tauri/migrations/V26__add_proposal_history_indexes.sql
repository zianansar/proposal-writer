-- Migration: V26 - Add indexes for optimized proposal history queries
-- Story: 8-7-memory-optimization-for-large-proposal-lists
-- Purpose: Support fast pagination and sorting on proposal history list (NFR-17: <500ms)

-- Index for fast sorting by created_at (proposal history list)
-- DESC order supports ORDER BY created_at DESC queries
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Composite index for pagination queries
-- Covers (id, created_at) to support efficient offset pagination
CREATE INDEX IF NOT EXISTS idx_proposals_id_created ON proposals(id, created_at DESC);
