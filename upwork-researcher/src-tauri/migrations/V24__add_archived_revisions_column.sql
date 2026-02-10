-- V24: Add archived_revisions column for compressed revision storage
-- Story 6-7: Archive Old Revisions

-- Add column for compressed archived revisions
-- Stored as flate2-compressed JSON array
ALTER TABLE proposals ADD COLUMN archived_revisions BLOB;

-- Note: archived_revisions contains a compressed JSON array:
-- [
--   { "id": 1, "content": "...", "revisionType": "edit", "restoredFromId": null, "createdAt": "..." },
--   { "id": 2, "content": "...", "revisionType": "edit", "restoredFromId": null, "createdAt": "..." }
-- ]
