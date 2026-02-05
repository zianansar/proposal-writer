-- V5: Add generation params column to proposals
-- Story 3.3: Humanization Injection During Generation
--
-- Humanization intensity is stored as a key-value setting via the existing settings table.
-- Code-level default: "medium" (AC6) — no seed row needed (avoids migration count mismatches).
-- The get_humanization_intensity Tauri command defaults to "medium" when key is absent.

-- Store generation params with proposals (prep for Story 3.4: re-humanization)
-- JSON string: {"humanization_intensity": "medium", ...}
ALTER TABLE proposals ADD COLUMN generation_params TEXT;
