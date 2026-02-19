-- Story 10.4: A/B Testing Framework for Hook Strategies
-- AC-1, AC-3: Add ab_weight to hook_strategies and ab tracking fields to proposals
-- Migration V29: Must run after V28 (hook_strategies status columns)

-- Add ab_weight column to hook_strategies so the weighted random selection
-- algorithm (Task 2) can read weights directly from strategy objects.
-- Default 0.0 means existing seed strategies are inactive for A/B testing
-- until a remote config sync sets their weights (Story 10.3 sync_hook_strategies).
ALTER TABLE hook_strategies ADD COLUMN ab_weight REAL NOT NULL DEFAULT 0.0;

-- Add ab_assigned flag to proposals table (AC-3: boolean as INTEGER per SQLite convention).
-- 0 = manual selection or pre-A/B proposal, 1 = A/B assigned.
-- NOT NULL with DEFAULT 0 ensures existing proposals get ab_assigned=0 (AC-1.5).
ALTER TABLE proposals ADD COLUMN ab_assigned INTEGER NOT NULL DEFAULT 0;

-- Add ab_weight_at_assignment to capture weight at generation time (AC-3, AC-5).
-- Nullable: NULL for manual selections and pre-A/B proposals.
ALTER TABLE proposals ADD COLUMN ab_weight_at_assignment REAL;

-- Index on ab_assigned for analytics filtering (NFR-4: <500ms with 10K proposals).
CREATE INDEX idx_proposals_ab_assigned ON proposals(ab_assigned);
