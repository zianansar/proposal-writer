-- Story 8.6: Add proposals_edited_count to settings table
-- Tracks number of proposals user has edited (for voice learning progress)
-- Uses existing key-value settings pattern (like humanization_intensity, safety_threshold)
-- Code-level default: 0 (no seed row needed)
-- The get_proposals_edited_count Tauri command defaults to 0 when key is absent

-- No table structure changes needed - uses existing settings table key-value store
