---
status: ready-for-dev
epic: 6
story: 7
assignedTo: ""
tasksCompleted: 0
totalTasks: 7
testsWritten: false
codeReviewCompleted: false
fileList: []
dependencies:
  - 6-3-proposal-revision-history
relates_to:
  - 6-8-delete-proposal-all-revisions
---

# Story 6.7: Archive Old Revisions

## Story

As a developer,
I want old revisions automatically archived,
So that the database doesn't grow unbounded.

## Acceptance Criteria

### AC1: Automatic Archiving Trigger

**Given** a proposal has >5 revisions (from Round 5 Occam's Razor: limit to 5)
**When** a new revision is created
**Then** the system automatically archives revisions beyond the 5 most recent
**And** active revisions table stays performant

### AC2: Archive Storage Format

**Given** revisions need archiving
**When** the archiving process runs
**Then** archived revisions are stored as compressed JSON blob in a separate `archived_revisions` column
**And** the compressed format reduces storage by ~60-80%
**And** the original revision rows are deleted from `proposal_revisions` table

### AC3: Read-Only Access to Archived Revisions

**Given** a proposal has archived revisions
**When** I view the revision history
**Then** archived revisions appear in a separate "Archived" section
**And** I can expand/preview archived revisions (read-only)
**And** archived revisions show their original timestamps
**And** restoration from archived revisions follows the same flow as active revisions

### AC4: Background Archiving

**Given** archiving is triggered
**When** the archive operation runs
**Then** it happens in background (doesn't block save)
**And** the user sees no delay in normal operations
**And** archiving failures are logged but don't fail the save operation

### AC5: Archive Count Display

**Given** a proposal has archived revisions
**When** I view the revision history
**Then** I see "X archived revisions" summary
**And** clicking expands to show full archived list

## Technical Notes

- From Round 5 Code Review: prevent 1000+ revision bloat
- Archiving after 5 revisions per Occam's Razor simplification
- Compressed storage for historical data
- Uses zstd or flate2 for compression (Rust native)
- Archive stored as JSON array in `proposals.archived_revisions` column

## Tasks / Subtasks

- [ ] Task 1: Create database migration for archived_revisions column (AC2)
  - [ ] 1.1: Create `V9__add_archived_revisions_column.sql` migration file
  - [ ] 1.2: Add `archived_revisions BLOB` column to `proposals` table
  - [ ] 1.3: Column stores compressed JSON array of archived revisions

- [ ] Task 2: Create Rust archive/compression module (AC2, AC4)
  - [ ] 2.1: Create `src-tauri/src/archive.rs` module for compression utilities
  - [ ] 2.2: Implement `compress_revisions(revisions: Vec<ProposalRevision>) -> Vec<u8>` using flate2
  - [ ] 2.3: Implement `decompress_revisions(data: &[u8]) -> Vec<ProposalRevision>`
  - [ ] 2.4: Add `ArchivedRevision` struct (subset of ProposalRevision fields)
  - [ ] 2.5: Add module to `lib.rs`

- [ ] Task 3: Create Rust archiving logic (AC1, AC2, AC4)
  - [ ] 3.1: Create `archive_old_revisions(conn, proposal_id)` function in `db/queries/revisions.rs`
  - [ ] 3.2: Query revisions count for proposal
  - [ ] 3.3: If >5 revisions, fetch all except 5 most recent
  - [ ] 3.4: Compress fetched revisions to JSON blob
  - [ ] 3.5: Append to existing `archived_revisions` column (merge with existing archive)
  - [ ] 3.6: Delete archived revision rows from `proposal_revisions` table
  - [ ] 3.7: Wrap in transaction for atomicity

- [ ] Task 4: Trigger archiving on revision creation (AC1, AC4)
  - [ ] 4.1: Modify `create_revision` function to call `archive_old_revisions` after insert
  - [ ] 4.2: Run archiving in background using `tokio::spawn` (non-blocking)
  - [ ] 4.3: Log archiving results (success/failure) with tracing
  - [ ] 4.4: Errors logged but don't fail the revision creation

- [ ] Task 5: Create Tauri commands for archived revision access (AC3, AC5)
  - [ ] 5.1: Create `get_archived_revisions(proposal_id)` command -> returns decompressed list
  - [ ] 5.2: Create `get_archived_revision_count(proposal_id)` command -> returns count
  - [ ] 5.3: Create `restore_archived_revision(proposal_id, archived_index)` command
  - [ ] 5.4: Register commands in `lib.rs`

- [ ] Task 6: Update RevisionHistoryPanel UI (AC3, AC5)
  - [ ] 6.1: Add "Archived" section to RevisionHistoryPanel
  - [ ] 6.2: Show "X archived revisions" collapsed summary
  - [ ] 6.3: Add expand/collapse toggle for archived list
  - [ ] 6.4: Style archived revisions distinctly (muted colors, archive icon)
  - [ ] 6.5: Enable preview and restore for archived revisions
  - [ ] 6.6: Update TypeScript types for archived revisions

- [ ] Task 7: Add tests (AC1-AC5)
  - [ ] 7.1: Rust test: compression/decompression round-trip
  - [ ] 7.2: Rust test: archiving triggers when >5 revisions
  - [ ] 7.3: Rust test: archiving preserves 5 most recent
  - [ ] 7.4: Rust test: archived revisions merge with existing archive
  - [ ] 7.5: Rust test: archiving is atomic (rollback on failure)
  - [ ] 7.6: React test: archived section displays correct count
  - [ ] 7.7: React test: expand/collapse toggles archived list
  - [ ] 7.8: React test: archived revision preview works
  - [ ] 7.9: React test: restore from archived creates new revision

## Dev Notes

### Architecture Context

**FR-8: Rich Text Editor** - Revision history must remain accessible while managing storage growth.

**NFR-3: Performance** - Active revision queries must stay fast; archiving must not impact save operations.

**Round 5 Occam's Razor** - Limit to 5 active revisions to prevent table bloat while preserving full history.

**Storage Strategy:**
- Active revisions: 5 most recent in `proposal_revisions` table (indexed, fast queries)
- Archived revisions: Compressed JSON blob in `proposals.archived_revisions` column
- Compression: flate2 (deflate) for ~70% size reduction on text data

### Database Migration

```sql
-- V9__add_archived_revisions_column.sql

-- Add column for compressed archived revisions
-- Stored as flate2-compressed JSON array
ALTER TABLE proposals ADD COLUMN archived_revisions BLOB;

-- Note: archived_revisions contains a compressed JSON array:
-- [
--   { "id": 1, "content": "...", "revision_type": "edit", "created_at": "..." },
--   { "id": 2, "content": "...", "revision_type": "edit", "created_at": "..." }
-- ]
```

### Rust Archive Module

```rust
// src-tauri/src/archive.rs

use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

use crate::db::queries::revisions::ProposalRevision;

/// Archived revision (lightweight version of ProposalRevision)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivedRevision {
    pub id: i64,
    pub content: String,
    pub revision_type: String,
    pub restored_from_id: Option<i64>,
    pub created_at: String,
}

impl From<ProposalRevision> for ArchivedRevision {
    fn from(rev: ProposalRevision) -> Self {
        ArchivedRevision {
            id: rev.id,
            content: rev.content,
            revision_type: rev.revision_type,
            restored_from_id: rev.restored_from_id,
            created_at: rev.created_at,
        }
    }
}

/// Compress revisions to a byte array
pub fn compress_revisions(revisions: &[ArchivedRevision]) -> Result<Vec<u8>, String> {
    let json = serde_json::to_vec(revisions).map_err(|e| e.to_string())?;

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&json).map_err(|e| e.to_string())?;
    encoder.finish().map_err(|e| e.to_string())
}

/// Decompress byte array to revisions
pub fn decompress_revisions(data: &[u8]) -> Result<Vec<ArchivedRevision>, String> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let mut decoder = ZlibDecoder::new(data);
    let mut json = Vec::new();
    decoder.read_to_end(&mut json).map_err(|e| e.to_string())?;

    serde_json::from_slice(&json).map_err(|e| e.to_string())
}

/// Merge new archived revisions with existing archive
pub fn merge_archives(
    existing: Option<&[u8]>,
    new_revisions: Vec<ArchivedRevision>,
) -> Result<Vec<u8>, String> {
    let mut all_revisions = match existing {
        Some(data) if !data.is_empty() => decompress_revisions(data)?,
        _ => Vec::new(),
    };

    all_revisions.extend(new_revisions);
    compress_revisions(&all_revisions)
}
```

### Rust Archiving Logic

```rust
// Add to src-tauri/src/db/queries/revisions.rs

use crate::archive::{self, ArchivedRevision};

const MAX_ACTIVE_REVISIONS: i64 = 5;

/// Archive old revisions when count exceeds threshold
/// Called after each revision creation
pub fn archive_old_revisions(conn: &Connection, proposal_id: i64) -> Result<u32, String> {
    let count = get_revision_count(conn, proposal_id)?;

    if count <= MAX_ACTIVE_REVISIONS {
        return Ok(0); // Nothing to archive
    }

    let to_archive = count - MAX_ACTIVE_REVISIONS;

    // Begin transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Fetch oldest revisions (the ones to archive)
    let mut stmt = tx.prepare(
        "SELECT id, proposal_id, content, revision_type, restored_from_id, created_at
         FROM proposal_revisions
         WHERE proposal_id = ?1
         ORDER BY created_at ASC
         LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let revisions_to_archive: Vec<ProposalRevision> = stmt.query_map(
        params![proposal_id, to_archive],
        |row| {
            Ok(ProposalRevision {
                id: row.get(0)?,
                proposal_id: row.get(1)?,
                content: row.get(2)?,
                revision_type: row.get(3)?,
                restored_from_id: row.get(4)?,
                created_at: row.get(5)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

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
    let existing_archive: Option<Vec<u8>> = tx.query_row(
        "SELECT archived_revisions FROM proposals WHERE id = ?1",
        params![proposal_id],
        |row| row.get(0),
    ).ok();

    // Merge with new archived revisions
    let new_archive = archive::merge_archives(
        existing_archive.as_deref(),
        archived,
    )?;

    // Update proposals table with new archive
    tx.execute(
        "UPDATE proposals SET archived_revisions = ?1 WHERE id = ?2",
        params![new_archive, proposal_id],
    ).map_err(|e| e.to_string())?;

    // Delete archived revisions from active table
    let placeholders = ids_to_delete.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    tx.execute(
        &format!(
            "DELETE FROM proposal_revisions WHERE id IN ({})",
            placeholders
        ),
        rusqlite::params_from_iter(ids_to_delete.iter()),
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    tracing::info!(
        proposal_id = proposal_id,
        archived_count = to_archive,
        "Archived old revisions"
    );

    Ok(to_archive as u32)
}

/// Get decompressed archived revisions for a proposal
pub fn get_archived_revisions(
    conn: &Connection,
    proposal_id: i64,
) -> Result<Vec<ArchivedRevision>, String> {
    let data: Option<Vec<u8>> = conn.query_row(
        "SELECT archived_revisions FROM proposals WHERE id = ?1",
        params![proposal_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    match data {
        Some(d) if !d.is_empty() => archive::decompress_revisions(&d),
        _ => Ok(Vec::new()),
    }
}

/// Get count of archived revisions
pub fn get_archived_revision_count(conn: &Connection, proposal_id: i64) -> Result<i64, String> {
    let archived = get_archived_revisions(conn, proposal_id)?;
    Ok(archived.len() as i64)
}
```

### Modify Revision Creation

```rust
// Update create_revision in src-tauri/src/db/queries/revisions.rs

/// Create a new revision (called on auto-save)
/// Triggers background archiving if revision count exceeds threshold
pub fn create_revision(
    conn: &Connection,
    proposal_id: i64,
    content: &str,
    revision_type: &str,
    restored_from_id: Option<i64>,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_type, restored_from_id)
         VALUES (?1, ?2, ?3, ?4)",
        params![proposal_id, content, revision_type, restored_from_id],
    ).map_err(|e| e.to_string())?;

    let revision_id = conn.last_insert_rowid();

    // Trigger archiving (non-blocking in Tauri command layer)
    // Note: Actual async spawn happens in Tauri command, not here

    Ok(revision_id)
}
```

### Tauri Commands

```rust
// Add to src-tauri/src/lib.rs

use crate::archive::ArchivedRevision;

/// Create a revision (called on auto-save from TipTap)
/// Triggers background archiving if needed
#[tauri::command]
pub async fn create_revision(
    proposal_id: i64,
    content: String,
    revision_type: Option<String>,
    database: State<'_, Database>,
) -> Result<i64, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;
    let rev_type = revision_type.unwrap_or_else(|| "edit".to_string());

    let revision_id = revisions::create_revision(&conn, proposal_id, &content, &rev_type, None)?;

    // Background archiving (fire-and-forget, errors logged but not propagated)
    let proposal_id_clone = proposal_id;
    let db_clone = database.clone();
    tokio::spawn(async move {
        match db_clone.conn.lock() {
            Ok(conn) => {
                if let Err(e) = revisions::archive_old_revisions(&conn, proposal_id_clone) {
                    tracing::warn!(
                        proposal_id = proposal_id_clone,
                        error = %e,
                        "Background archiving failed"
                    );
                }
            }
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Failed to acquire lock for archiving"
                );
            }
        }
    });

    Ok(revision_id)
}

/// Get archived revisions for a proposal
#[tauri::command]
pub async fn get_archived_revisions(
    proposal_id: i64,
    database: State<'_, Database>,
) -> Result<Vec<ArchivedRevision>, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;
    revisions::get_archived_revisions(&conn, proposal_id)
}

/// Get count of archived revisions
#[tauri::command]
pub async fn get_archived_revision_count(
    proposal_id: i64,
    database: State<'_, Database>,
) -> Result<i64, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;
    revisions::get_archived_revision_count(&conn, proposal_id)
}

/// Restore an archived revision
/// Creates new revision from archived content
#[tauri::command]
pub async fn restore_archived_revision(
    proposal_id: i64,
    archived_index: usize,
    database: State<'_, Database>,
) -> Result<i64, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;

    // Get archived revisions
    let archived = revisions::get_archived_revisions(&conn, proposal_id)?;

    let source = archived.get(archived_index)
        .ok_or_else(|| format!("Archived revision at index {} not found", archived_index))?;

    // Create new "restore" revision with archived content
    let new_revision_id = revisions::create_revision(
        &conn,
        proposal_id,
        &source.content,
        "restore",
        Some(source.id), // Reference the original archived revision ID
    )?;

    // Update the proposal's current content
    conn.execute(
        "UPDATE proposals SET generated_text = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![source.content, proposal_id],
    ).map_err(|e| e.to_string())?;

    tracing::info!(
        proposal_id = proposal_id,
        archived_index = archived_index,
        original_revision_id = source.id,
        new_revision_id = new_revision_id,
        "Restored proposal from archived revision"
    );

    Ok(new_revision_id)
}
```

### TypeScript Types

```typescript
// Add to src/types/revisions.ts

export interface ArchivedRevision {
  id: number;
  content: string;
  revisionType: 'generation' | 'edit' | 'restore';
  restoredFromId: number | null;
  createdAt: string;  // ISO timestamp
}
```

### UI Updates (RevisionHistoryPanel.tsx)

```tsx
// Update src/components/RevisionHistoryPanel.tsx

import type { ArchivedRevision } from '../types/revisions';

// Add to Props
interface Props {
  proposalId: number;
  onRestore: (content: string) => void;
  onClose: () => void;
}

// Add new state
const [archivedRevisions, setArchivedRevisions] = useState<ArchivedRevision[]>([]);
const [archivedExpanded, setArchivedExpanded] = useState(false);
const [selectedArchived, setSelectedArchived] = useState<ArchivedRevision | null>(null);

// Load archived revisions
useEffect(() => {
  async function loadArchived() {
    try {
      const data = await invoke<ArchivedRevision[]>('get_archived_revisions', { proposalId });
      setArchivedRevisions(data);
    } catch (err) {
      console.error('Failed to load archived revisions:', err);
    }
  }
  loadArchived();
}, [proposalId]);

// Handle restore from archived
const handleRestoreArchived = useCallback(async () => {
  if (!selectedArchived) return;

  const index = archivedRevisions.findIndex(r => r.id === selectedArchived.id);
  if (index === -1) return;

  const confirmed = window.confirm(
    'Restore this archived version? A new revision will be created.'
  );
  if (!confirmed) return;

  try {
    await invoke('restore_archived_revision', {
      proposalId,
      archivedIndex: index,
    });
    onRestore(selectedArchived.content);
    onClose();
  } catch (err) {
    setError(err as string);
  }
}, [selectedArchived, archivedRevisions, proposalId, onRestore, onClose]);

// Render archived section (add after active revisions list)
{archivedRevisions.length > 0 && (
  <div className="archived-section">
    <button
      className="archived-header"
      onClick={() => setArchivedExpanded(!archivedExpanded)}
    >
      <span className="archive-icon">📦</span>
      <span>{archivedRevisions.length} archived revision{archivedRevisions.length !== 1 ? 's' : ''}</span>
      <span className="expand-icon">{archivedExpanded ? '▼' : '▶'}</span>
    </button>

    {archivedExpanded && (
      <div className="archived-list">
        {archivedRevisions.map((rev, index) => (
          <button
            key={rev.id}
            className={`revision-item archived ${selectedArchived?.id === rev.id ? 'selected' : ''}`}
            onClick={() => setSelectedArchived(rev)}
          >
            <span className="revision-time">{formatRelativeTime(rev.createdAt)}</span>
            <span className="revision-type">{rev.revisionType}</span>
            <span className="revision-preview">{rev.content.substring(0, 50)}...</span>
          </button>
        ))}
      </div>
    )}
  </div>
)}

// Update preview pane to handle archived revisions
{selectedArchived && (
  <div className="revision-preview-pane archived-preview">
    <div className="preview-header">
      <span>Archived: {formatRelativeTime(selectedArchived.createdAt)}</span>
      <button onClick={handleRestoreArchived} className="restore-button">
        Restore this version
      </button>
    </div>
    <div className="preview-content" aria-readonly="true">
      {selectedArchived.content}
    </div>
  </div>
)}
```

### CSS Updates

```css
/* Add to src/components/RevisionHistoryPanel.css */

.archived-section {
  border-top: 2px solid var(--border-color);
  margin-top: 0.5rem;
}

.archived-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.archived-header:hover {
  background: var(--bg-hover);
}

.archive-icon {
  font-size: 1rem;
}

.expand-icon {
  margin-left: auto;
  font-size: 0.75rem;
}

.archived-list {
  max-height: 200px;
  overflow-y: auto;
}

.revision-item.archived {
  opacity: 0.8;
  background: var(--bg-muted);
}

.revision-item.archived:hover {
  opacity: 1;
}

.archived-preview {
  background: var(--bg-archived);
  border-left: 3px solid var(--color-archived);
}
```

### File Structure

```
upwork-researcher/
  src-tauri/
    migrations/
      V9__add_archived_revisions_column.sql   # NEW: Migration
    src/
      archive.rs                               # NEW: Compression utilities
      db/
        queries/
          revisions.rs                         # MODIFY: Add archiving functions
          mod.rs                               # MODIFY: Export archive module
      lib.rs                                   # MODIFY: Add archive commands
  src/
    types/
      revisions.ts                             # MODIFY: Add ArchivedRevision type
    components/
      RevisionHistoryPanel.tsx                 # MODIFY: Add archived section
      RevisionHistoryPanel.css                 # MODIFY: Add archived styles
      RevisionHistoryPanel.test.tsx            # MODIFY: Add archived tests
```

### Testing Requirements

**Rust Unit Tests:**

1. `test_compress_decompress_roundtrip()` — Data integrity after compression
2. `test_compress_empty_array()` — Handle empty input
3. `test_decompress_empty_data()` — Handle empty/null blob
4. `test_archive_triggers_at_threshold()` — Archives when >5 revisions
5. `test_archive_preserves_5_most_recent()` — Correct revisions remain active
6. `test_archive_merges_with_existing()` — Multiple archive operations merge correctly
7. `test_archive_atomic_transaction()` — Rollback on failure
8. `test_archive_deletes_from_active()` — Archived rows removed from table
9. `test_get_archived_count()` — Returns correct count
10. `test_restore_from_archived()` — Creates new revision from archived content

**React Component Tests:**

1. `test_archived_section_hidden_when_empty()` — No section if no archived
2. `test_archived_count_displays_correctly()` — Shows correct "X archived"
3. `test_archived_section_expands_on_click()` — Toggle functionality
4. `test_archived_revision_preview()` — Selecting shows content
5. `test_restore_archived_calls_command()` — Invokes Tauri command
6. `test_archived_styling_distinct()` — Muted/archived styles applied

### Dependency Requirements

**Rust Dependencies (add to Cargo.toml if not present):**

```toml
[dependencies]
flate2 = "1.0"  # Compression library
```

**No new frontend dependencies required.**

### Cross-Story Dependencies

**Depends On:**
- **Story 6-3: Proposal Revision History** — Creates `proposal_revisions` table and revision management
- **Story 1-11: Database Migration Framework** — Migration infrastructure

**Depended On By:**
- None (this is a background optimization)

**Relates To:**
- **Story 6-8: Delete Proposal & All Revisions** — Must also delete archived revisions

### Performance Targets

- Archive operation: <100ms (background, non-blocking)
- Compression ratio: 60-80% reduction for text content
- Decompress + deserialize: <50ms for up to 100 archived revisions
- No measurable impact on save latency

### Scope Boundaries

**In Scope:**
- Database migration for `archived_revisions` column
- Compression/decompression utilities (flate2)
- Automatic archiving when >5 revisions
- Background execution (non-blocking)
- UI for viewing/restoring archived revisions
- Merge logic for multiple archive operations

**Out of Scope:**
- Configurable archive threshold (hardcoded to 5)
- Manual archive trigger
- Archive cleanup/deletion (handled by Story 6-8)
- Archive export to external file

### Definition of Done

- [ ] All tasks/subtasks marked complete
- [ ] All Rust tests pass (compression, archiving logic)
- [ ] All React tests pass (UI, archived section)
- [ ] Archiving triggers automatically when >5 revisions
- [ ] Archived revisions viewable in history panel
- [ ] Archived revisions restorable
- [ ] Save operation not blocked by archiving
- [ ] No regressions in Story 6-3 functionality
- [ ] flate2 dependency added and working

## Change Log

- 2026-02-07: Story prepared for development by Scrum Master (Bob) — added full task breakdown, architecture context, implementation details with Rust/TypeScript code, testing requirements, cross-story dependencies, and file structure. Based on Story 6-3 patterns and Round 5 Occam's Razor decisions.
