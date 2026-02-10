// src-tauri/src/db/queries/revisions.rs
// Proposal revision history operations

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Revision metadata for list display (without full content)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionSummary {
    pub id: i64,
    pub proposal_id: i64,
    pub revision_type: String,
    pub restored_from_id: Option<i64>,
    pub created_at: String,
    pub content_preview: String, // First 50 chars
}

/// Full revision for preview/restore
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProposalRevision {
    pub id: i64,
    pub proposal_id: i64,
    pub content: String,
    pub revision_type: String,
    pub restored_from_id: Option<i64>,
    pub created_at: String,
}

/// Create a new revision (called on auto-save)
pub fn create_revision(
    conn: &Connection,
    proposal_id: i64,
    content: &str,
    revision_type: &str,
    restored_from_id: Option<i64>,
) -> Result<i64, String> {
    // Validate revision_type
    if !matches!(revision_type, "generation" | "edit" | "restore") {
        return Err(format!(
            "Invalid revision_type: {}. Must be 'generation', 'edit', or 'restore'",
            revision_type
        ));
    }

    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_type, restored_from_id, revision_number)
         VALUES (?1, ?2, ?3, ?4,
            COALESCE((SELECT MAX(revision_number) + 1 FROM proposal_revisions WHERE proposal_id = ?1), 1)
         )",
        params![proposal_id, content, revision_type, restored_from_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

/// Get revision summaries for a proposal (newest first)
pub fn get_revisions(
    conn: &Connection,
    proposal_id: i64,
) -> Result<Vec<RevisionSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, proposal_id, revision_type, restored_from_id, created_at,
                SUBSTR(content, 1, 50) as content_preview
         FROM proposal_revisions
         WHERE proposal_id = ?1
         ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let revisions = stmt
        .query_map(params![proposal_id], |row| {
            Ok(RevisionSummary {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                revision_type: row.get(2)?,
                restored_from_id: row.get(3)?,
                created_at: row.get(4)?,
                content_preview: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    revisions
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Get full revision content for preview
pub fn get_revision(conn: &Connection, revision_id: i64) -> Result<ProposalRevision, String> {
    conn.query_row(
        "SELECT id, proposal_id, content, revision_type, restored_from_id, created_at
         FROM proposal_revisions
         WHERE id = ?1",
        params![revision_id],
        |row| {
            Ok(ProposalRevision {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                content: row.get(2)?,
                revision_type: row.get(3)?,
                restored_from_id: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Get revision count for warning threshold
pub fn get_revision_count(conn: &Connection, proposal_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = ?1",
        params![proposal_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

// ============================================================================
// Archiving Functions (Story 6-7: Archive Old Revisions)
// ============================================================================

use crate::archive::{self, ArchivedRevision};

const MAX_ACTIVE_REVISIONS: i64 = 5;

/// Archive old revisions when count exceeds threshold
/// Called after each revision creation
pub fn archive_old_revisions(conn: &mut Connection, proposal_id: i64) -> Result<u32, String> {
    let count = get_revision_count(conn, proposal_id)?;

    if count <= MAX_ACTIVE_REVISIONS {
        return Ok(0); // Nothing to archive
    }

    let to_archive = count - MAX_ACTIVE_REVISIONS;

    // Begin transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Fetch oldest revisions (the ones to archive)
    let mut stmt = tx
        .prepare(
            "SELECT id, proposal_id, content, revision_type, restored_from_id, created_at
         FROM proposal_revisions
         WHERE proposal_id = ?1
         ORDER BY created_at ASC
         LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let revisions_to_archive: Vec<ProposalRevision> = stmt
        .query_map(params![proposal_id, to_archive], |row| {
            Ok(ProposalRevision {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                content: row.get(2)?,
                revision_type: row.get(3)?,
                restored_from_id: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt); // Explicitly drop stmt before transaction operations

    if revisions_to_archive.is_empty() {
        return Ok(0);
    }

    // Get IDs to delete
    let ids_to_delete: Vec<i64> = revisions_to_archive.iter().map(|r| r.id).collect();

    // Convert to archived format
    let archived: Vec<ArchivedRevision> = revisions_to_archive
        .into_iter()
        .map(ArchivedRevision::from)
        .collect();

    // Get existing archive
    let existing_archive: Option<Vec<u8>> = tx
        .query_row(
            "SELECT archived_revisions FROM proposals WHERE id = ?1",
            params![proposal_id],
            |row| row.get(0),
        )
        .ok();

    // Merge with new archived revisions
    let new_archive = archive::merge_archives(existing_archive.as_deref(), archived)?;

    // Update proposals table with new archive
    tx.execute(
        "UPDATE proposals SET archived_revisions = ?1 WHERE id = ?2",
        params![new_archive, proposal_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete archived revisions from active table
    let placeholders = ids_to_delete
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    tx.execute(
        &format!(
            "DELETE FROM proposal_revisions WHERE id IN ({})",
            placeholders
        ),
        rusqlite::params_from_iter(ids_to_delete.iter()),
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    tracing::info!(
        proposal_id = proposal_id,
        archived_count = to_archive,
        "Archived old revisions"
    );

    Ok(to_archive as u32)
}

/// Get decompressed archived revisions for a proposal
/// Returns empty list if archive data is corrupt (graceful degradation)
pub fn get_archived_revisions(
    conn: &Connection,
    proposal_id: i64,
) -> Result<Vec<ArchivedRevision>, String> {
    let data: Option<Vec<u8>> = conn
        .query_row(
            "SELECT archived_revisions FROM proposals WHERE id = ?1",
            params![proposal_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    match data {
        Some(d) if !d.is_empty() => {
            // Gracefully handle corrupt archive data (M2 fix)
            match archive::decompress_revisions(&d) {
                Ok(revisions) => Ok(revisions),
                Err(e) => {
                    tracing::warn!(
                        proposal_id = proposal_id,
                        error = %e,
                        "Failed to decompress archived revisions - returning empty list"
                    );
                    Ok(Vec::new())
                }
            }
        }
        _ => Ok(Vec::new()),
    }
}

/// Get count of archived revisions
pub fn get_archived_revision_count(conn: &Connection, proposal_id: i64) -> Result<i64, String> {
    let archived = get_archived_revisions(conn, proposal_id)?;
    Ok(archived.len() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();

        // Create proposals table
        conn.execute(
            "CREATE TABLE proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_url TEXT NOT NULL,
                generated_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )
        .unwrap();

        // Create proposal_revisions table with new schema
        conn.execute(
            "CREATE TABLE proposal_revisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proposal_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                revision_number INTEGER NOT NULL,
                revision_type TEXT NOT NULL DEFAULT 'edit'
                    CHECK (revision_type IN ('generation', 'edit', 'restore')),
                restored_from_id INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
                FOREIGN KEY (restored_from_id) REFERENCES proposal_revisions(id)
            )",
            [],
        )
        .unwrap();

        // Create indexes
        conn.execute(
            "CREATE INDEX idx_proposal_revisions_proposal_created
                ON proposal_revisions(proposal_id, created_at DESC)",
            [],
        )
        .unwrap();

        conn
    }

    #[test]
    fn test_create_revision_inserts_correctly() {
        let conn = setup_test_db();

        // Insert test proposal
        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test proposal')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create revision
        let revision_id =
            create_revision(&conn, proposal_id, "First revision content", "edit", None).unwrap();

        assert!(revision_id > 0);

        // Verify revision was created
        let revision = get_revision(&conn, revision_id).unwrap();
        assert_eq!(revision.proposal_id, proposal_id);
        assert_eq!(revision.content, "First revision content");
        assert_eq!(revision.revision_type, "edit");
        assert_eq!(revision.restored_from_id, None);
    }

    #[test]
    fn test_create_revision_all_types() {
        let conn = setup_test_db();

        // Insert test proposal
        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Test generation type
        let gen_id =
            create_revision(&conn, proposal_id, "Generated", "generation", None).unwrap();
        let gen_rev = get_revision(&conn, gen_id).unwrap();
        assert_eq!(gen_rev.revision_type, "generation");

        // Test edit type
        let edit_id = create_revision(&conn, proposal_id, "Edited", "edit", None).unwrap();
        let edit_rev = get_revision(&conn, edit_id).unwrap();
        assert_eq!(edit_rev.revision_type, "edit");

        // Test restore type
        let restore_id =
            create_revision(&conn, proposal_id, "Restored", "restore", Some(gen_id)).unwrap();
        let restore_rev = get_revision(&conn, restore_id).unwrap();
        assert_eq!(restore_rev.revision_type, "restore");
        assert_eq!(restore_rev.restored_from_id, Some(gen_id));
    }

    #[test]
    fn test_create_revision_invalid_type() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        let result = create_revision(&conn, proposal_id, "Content", "invalid", None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid revision_type"));
    }

    #[test]
    fn test_get_revisions_returns_newest_first() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create three revisions with explicit timestamps to ensure ordering
        let id1 = create_revision(&conn, proposal_id, "First revision", "edit", None).unwrap();
        conn.execute(
            "UPDATE proposal_revisions SET created_at = datetime('2024-01-01 10:00:00') WHERE id = ?1",
            params![id1],
        )
        .unwrap();

        let id2 = create_revision(&conn, proposal_id, "Second revision", "edit", None).unwrap();
        conn.execute(
            "UPDATE proposal_revisions SET created_at = datetime('2024-01-01 11:00:00') WHERE id = ?1",
            params![id2],
        )
        .unwrap();

        let id3 = create_revision(&conn, proposal_id, "Third revision", "edit", None).unwrap();
        conn.execute(
            "UPDATE proposal_revisions SET created_at = datetime('2024-01-01 12:00:00') WHERE id = ?1",
            params![id3],
        )
        .unwrap();

        let revisions = get_revisions(&conn, proposal_id).unwrap();
        assert_eq!(revisions.len(), 3);
        // Newest first (most recent timestamp)
        assert_eq!(revisions[0].id, id3);
        assert_eq!(revisions[0].content_preview, "Third revision");
        assert_eq!(revisions[1].id, id2);
        assert_eq!(revisions[1].content_preview, "Second revision");
        assert_eq!(revisions[2].id, id1);
        assert_eq!(revisions[2].content_preview, "First revision");
    }

    #[test]
    fn test_get_revisions_empty_for_new_proposal() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        let revisions = get_revisions(&conn, proposal_id).unwrap();
        assert_eq!(revisions.len(), 0);
    }

    #[test]
    fn test_get_revision_returns_correct_content() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        let long_content = "This is a very long content that should be stored completely in the database and not truncated when retrieved";
        let revision_id = create_revision(&conn, proposal_id, long_content, "edit", None).unwrap();

        let revision = get_revision(&conn, revision_id).unwrap();
        assert_eq!(revision.content, long_content);
    }

    #[test]
    fn test_get_revision_count() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Initially no revisions
        let count = get_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(count, 0);

        // Add 3 revisions
        create_revision(&conn, proposal_id, "Rev 1", "edit", None).unwrap();
        create_revision(&conn, proposal_id, "Rev 2", "edit", None).unwrap();
        create_revision(&conn, proposal_id, "Rev 3", "edit", None).unwrap();

        let count = get_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn test_revision_with_restored_from_id() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create original revision
        let original_id =
            create_revision(&conn, proposal_id, "Original", "generation", None).unwrap();

        // Create restore revision
        let restored_id = create_revision(
            &conn,
            proposal_id,
            "Original",
            "restore",
            Some(original_id),
        )
        .unwrap();

        let restored = get_revision(&conn, restored_id).unwrap();
        assert_eq!(restored.revision_type, "restore");
        assert_eq!(restored.restored_from_id, Some(original_id));
    }

    #[test]
    fn test_cascade_delete_on_proposal_delete() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create revisions
        create_revision(&conn, proposal_id, "Rev 1", "edit", None).unwrap();
        create_revision(&conn, proposal_id, "Rev 2", "edit", None).unwrap();

        // Verify revisions exist
        let count_before = get_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(count_before, 2);

        // Delete proposal
        conn.execute("DELETE FROM proposals WHERE id = ?1", params![proposal_id])
            .unwrap();

        // Verify revisions were deleted
        let count_after = get_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(count_after, 0);
    }

    // ========================================================================
    // Archive Tests (Story 6-7)
    // ========================================================================

    fn setup_test_db_with_archive() -> Connection {
        let conn = setup_test_db();
        // Add archived_revisions column
        conn.execute("ALTER TABLE proposals ADD COLUMN archived_revisions BLOB", [])
            .unwrap();
        conn
    }

    #[test]
    fn test_archive_triggers_at_threshold() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create 6 revisions (exceeds MAX_ACTIVE_REVISIONS = 5)
        for i in 1..=6 {
            create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
        }

        // Archive should trigger
        let archived_count = archive_old_revisions(&mut conn, proposal_id).unwrap();
        assert_eq!(archived_count, 1); // 6 - 5 = 1 archived

        // Active count should be 5
        let active_count = get_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(active_count, 5);

        // Archived count should be 1
        let archived_count = get_archived_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(archived_count, 1);
    }

    #[test]
    fn test_archive_preserves_5_most_recent() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create 8 revisions with explicit timestamps
        let mut revision_ids = Vec::new();
        for i in 1..=8 {
            let id =
                create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
            conn.execute(
                "UPDATE proposal_revisions SET created_at = datetime(?) WHERE id = ?",
                params![format!("2024-01-01 {:02}:00:00", i), id],
            )
            .unwrap();
            revision_ids.push(id);
        }

        // Archive
        archive_old_revisions(&mut conn, proposal_id).unwrap();

        // Get active revisions
        let active = get_revisions(&conn, proposal_id).unwrap();
        assert_eq!(active.len(), 5);

        // Should keep revisions 4-8 (5 most recent)
        assert_eq!(active[0].id, revision_ids[7]); // Rev 8 (newest)
        assert_eq!(active[1].id, revision_ids[6]); // Rev 7
        assert_eq!(active[2].id, revision_ids[5]); // Rev 6
        assert_eq!(active[3].id, revision_ids[4]); // Rev 5
        assert_eq!(active[4].id, revision_ids[3]); // Rev 4 (oldest of active)

        // Archived should be revisions 1-3
        let archived = get_archived_revisions(&conn, proposal_id).unwrap();
        assert_eq!(archived.len(), 3);
        assert_eq!(archived[0].id, revision_ids[0]); // Rev 1 (oldest archived)
        assert_eq!(archived[1].id, revision_ids[1]); // Rev 2
        assert_eq!(archived[2].id, revision_ids[2]); // Rev 3
    }

    #[test]
    fn test_archive_merges_with_existing() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create 7 revisions
        for i in 1..=7 {
            create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
        }

        // First archive (archives 2 revisions: 7 - 5 = 2)
        archive_old_revisions(&mut conn, proposal_id).unwrap();
        let archived_1 = get_archived_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(archived_1, 2);

        // Add 3 more revisions (total active: 5 + 3 = 8)
        for i in 8..=10 {
            create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
        }

        // Second archive (archives 3 more: 8 - 5 = 3)
        archive_old_revisions(&mut conn, proposal_id).unwrap();

        // Total archived should be 2 + 3 = 5
        let archived_2 = get_archived_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(archived_2, 5);

        // Active should still be 5
        let active = get_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(active, 5);
    }

    #[test]
    fn test_archive_atomic_transaction() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create 6 revisions
        for i in 1..=6 {
            create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
        }

        // Archive should succeed atomically
        let result = archive_old_revisions(&mut conn, proposal_id);
        assert!(result.is_ok());

        // Both active and archived should be updated
        let active_count = get_revision_count(&conn, proposal_id).unwrap();
        let archived_count = get_archived_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(active_count, 5);
        assert_eq!(archived_count, 1);
    }

    #[test]
    fn test_archive_deletes_from_active() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create 6 revisions with explicit timestamps
        let mut revision_ids = Vec::new();
        for i in 1..=6 {
            let id =
                create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
            // Set explicit timestamps to ensure ordering
            conn.execute(
                "UPDATE proposal_revisions SET created_at = datetime(?) WHERE id = ?",
                params![format!("2024-01-01 {:02}:00:00", i), id],
            )
            .unwrap();
            revision_ids.push(id);
        }

        // Archive
        archive_old_revisions(&mut conn, proposal_id).unwrap();

        // First revision (oldest) should be deleted from active table
        let result = get_revision(&conn, revision_ids[0]);
        assert!(result.is_err());

        // Last 5 revisions should still exist in active table
        for id in &revision_ids[1..6] {
            let result = get_revision(&conn, *id);
            assert!(result.is_ok());
        }
    }

    #[test]
    fn test_get_archived_count() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Initially 0 archived
        let count = get_archived_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(count, 0);

        // Create 10 revisions and archive
        for i in 1..=10 {
            create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
        }
        archive_old_revisions(&mut conn, proposal_id).unwrap();

        // Should have 5 archived (10 - 5 active)
        let count = get_archived_revision_count(&conn, proposal_id).unwrap();
        assert_eq!(count, 5);
    }

    /// L2: Test that archiving is triggered after restore operations
    /// Simulates the behavior of restore_revision and restore_archived_revision commands
    /// Note: Uses None for restored_from_id to avoid FK issues in test environment
    #[test]
    fn test_archiving_triggers_after_restore_operation() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create exactly 5 revisions (at threshold)
        for i in 1..=5 {
            let id = create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
            conn.execute(
                "UPDATE proposal_revisions SET created_at = datetime(?) WHERE id = ?",
                params![format!("2024-01-01 {:02}:00:00", i), id],
            )
            .unwrap();
        }

        // Verify 5 active, 0 archived
        assert_eq!(get_revision_count(&conn, proposal_id).unwrap(), 5);
        assert_eq!(get_archived_revision_count(&conn, proposal_id).unwrap(), 0);

        // Simulate restore operation: create a "restore" type revision
        // This pushes count to 6
        // Note: Using None for restored_from_id to keep test simple
        let restore_id = create_revision(
            &conn,
            proposal_id,
            "Restored content",
            "restore",
            None, // FK reference not needed for this test
        )
        .unwrap();
        assert!(restore_id > 0);

        // Now trigger archiving (as lib.rs commands do after creating restore revision)
        let archived_count = archive_old_revisions(&mut conn, proposal_id).unwrap();

        // Should have archived 1 revision (6 - 5 = 1)
        assert_eq!(archived_count, 1);

        // Verify final state: 5 active, 1 archived
        assert_eq!(get_revision_count(&conn, proposal_id).unwrap(), 5);
        assert_eq!(get_archived_revision_count(&conn, proposal_id).unwrap(), 1);

        // Verify the archived revision is the oldest one (Rev 1)
        let archived = get_archived_revisions(&conn, proposal_id).unwrap();
        assert_eq!(archived.len(), 1);
        assert!(archived[0].content.contains("Rev 1"));
    }

    /// L2: Test archiving after multiple consecutive restore operations
    #[test]
    fn test_archiving_after_multiple_restores() {
        let mut conn = setup_test_db_with_archive();

        conn.execute(
            "INSERT INTO proposals (job_url, generated_text) VALUES ('http://test.com', 'Test')",
            [],
        )
        .unwrap();
        let proposal_id = conn.last_insert_rowid();

        // Create 5 revisions
        for i in 1..=5 {
            let id = create_revision(&conn, proposal_id, &format!("Rev {}", i), "edit", None).unwrap();
            conn.execute(
                "UPDATE proposal_revisions SET created_at = datetime(?) WHERE id = ?",
                params![format!("2024-01-01 {:02}:00:00", i), id],
            )
            .unwrap();
        }

        // Simulate 3 consecutive restore operations
        for i in 1..=3 {
            create_revision(
                &conn,
                proposal_id,
                &format!("Restore {}", i),
                "restore",
                None, // FK reference not needed for this test
            )
            .unwrap();

            // Trigger archiving after each restore (as lib.rs does)
            archive_old_revisions(&mut conn, proposal_id).unwrap();
        }

        // Final state: 5 active, 3 archived
        assert_eq!(get_revision_count(&conn, proposal_id).unwrap(), 5);
        assert_eq!(get_archived_revision_count(&conn, proposal_id).unwrap(), 3);
    }
}
