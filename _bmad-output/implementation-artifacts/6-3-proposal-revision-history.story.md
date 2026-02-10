---
status: done
assignedTo: "Amelia (Dev Agent)"
tasksCompleted: 7
totalTasks: 7
testsWritten: true
codeReviewCompleted: true
codeReviewDate: "2026-02-10"
codeReviewFindings: 10
codeReviewFixesApplied: 10
fileList:
  - upwork-researcher/src-tauri/migrations/V23__add_revision_type_and_restored_from.sql
  - upwork-researcher/src-tauri/src/db/queries/revisions.rs
  - upwork-researcher/src-tauri/src/db/queries/mod.rs
  - upwork-researcher/src-tauri/src/lib.rs
  - upwork-researcher/src-tauri/tests/migration_v23_test.rs
  - upwork-researcher/src/hooks/useProposalEditor.ts
  - upwork-researcher/src/types/revisions.ts
  - upwork-researcher/src/utils/dateUtils.ts
  - upwork-researcher/src/utils/dateUtils.test.ts
  - upwork-researcher/src/components/RevisionHistoryPanel.tsx
  - upwork-researcher/src/components/RevisionHistoryPanel.css
  - upwork-researcher/src/components/RevisionHistoryPanel.test.tsx
  - upwork-researcher/src/components/ProposalEditor.tsx
  - upwork-researcher/src/components/EditorToolbar.tsx
---

# Story 6.3: Proposal Revision History

## Story

As a freelancer,
I want to see previous versions of a proposal,
So that I can revert if I make a mistake.

## Acceptance Criteria

**AC-1: Create Revision on Each Save**

**Given** I edit a proposal in the TipTap editor (Story 6-1)
**When** the auto-save triggers (2-second debounce)
**Then** a new revision is created in the `proposal_revisions` table
**And** the revision stores the full content at that point in time
**And** the revision includes a timestamp
**And** the proposal's `generated_text` is also updated (current version)

**AC-2: View Revision History**

**Given** a proposal has been edited multiple times
**When** I click "View History" button in the editor toolbar
**Then** I see a revision history panel/modal with:
- List of revisions sorted by timestamp (newest first)
- Each revision shows: relative timestamp (e.g., "2 minutes ago", "Yesterday at 3:45 PM")
- Each revision shows: preview snippet (first 50 characters)
- Current version highlighted/labeled as "Current"
**And** the history panel loads in <200ms (local SQLite query)

**AC-3: Preview Revision Content**

**Given** I'm viewing the revision history
**When** I click on a revision entry
**Then** I see a read-only preview of the full revision content
**And** the preview is visually distinct from the editable area (different background, "Preview" label)
**And** I can compare it to current content side-by-side (optional enhancement)

**AC-4: Restore Previous Version**

**Given** I'm previewing a previous revision
**When** I click "Restore this version"
**Then** the editor content is replaced with the restored version
**And** a NEW revision is created (restoration doesn't delete history)
**And** the new revision is labeled/tagged as "Restored from [timestamp]"
**And** the proposal's `generated_text` is updated to the restored content

**AC-5: Immutable Revision Log**

**Given** revisions are stored in the database
**Then** revisions are never deleted directly (immutable append-only log)
**And** only Story 6-7 (archive) and Story 6-8 (delete proposal) can remove revisions
**And** restoration creates new entries, never overwrites existing ones

**AC-6: Revision Count Limit (Prepare for Story 6-7)**

**Given** a proposal accumulates many revisions
**When** viewing history
**Then** all revisions are shown (no limit in this story)
**And** a warning is displayed if >5 revisions exist: "Consider archiving older versions"
**And** Story 6-7 will handle automatic archiving (out of scope here)

**AC-7: Close History Panel**

**Given** the history panel is open
**When** I click "Close" or press Escape
**Then** the panel closes
**And** I return to normal editing mode
**And** keyboard focus returns to the editor

## Tasks/Subtasks

- [x] Task 1: Create database migration for proposal_revisions table (AC-1, AC-5)
  - [x] Subtask 1.1: Create `V8__create_proposal_revisions_table.sql` migration file
  - [x] Subtask 1.2: Define table schema with proposal_id foreign key
  - [x] Subtask 1.3: Add index on (proposal_id, created_at DESC) for fast history queries
  - [x] Subtask 1.4: Add optional `revision_type` column ('edit', 'restore', 'generation')
  - [x] Subtask 1.5: Add optional `restored_from_id` column for tracking restoration source

- [x] Task 2: Create Rust database operations (AC-1, AC-2, AC-4)
  - [x] Subtask 2.1: Add `ProposalRevision` struct in `db/queries/revisions.rs`
  - [x] Subtask 2.2: Implement `create_revision(proposal_id, content, revision_type)` function
  - [x] Subtask 2.3: Implement `get_revisions(proposal_id)` -> Vec<ProposalRevision>
  - [x] Subtask 2.4: Implement `get_revision(revision_id)` for single revision fetch
  - [x] Subtask 2.5: Implement `get_revision_count(proposal_id)` for warning threshold
  - [x] Subtask 2.6: Add module to `db/queries/mod.rs`

- [x] Task 3: Create Tauri commands (AC-1, AC-2, AC-3, AC-4)
  - [x] Subtask 3.1: Create `create_revision` command (called on auto-save)
  - [x] Subtask 3.2: Create `get_proposal_revisions` command -> returns list with metadata
  - [x] Subtask 3.3: Create `get_revision_content` command -> returns full content for preview
  - [x] Subtask 3.4: Create `restore_revision` command -> creates new revision + updates proposal
  - [x] Subtask 3.5: Register commands in `lib.rs`
  - [x] Subtask 3.6: Add proper error handling with AppError mapping

- [x] Task 4: Modify auto-save to create revisions (AC-1)
  - [x] Subtask 4.1: Update `useProposalEditor` hook to call `create_revision` on save
  - [x] Subtask 4.2: Ensure both `proposals.generated_text` AND `proposal_revisions` are updated
  - [x] Subtask 4.3: Handle errors gracefully (log but don't block save)
  - [x] Subtask 4.4: Debounce to prevent revision spam (inherit 2s from Story 6-1)

- [x] Task 5: Build Revision History UI component (AC-2, AC-3, AC-7)
  - [x] Subtask 5.1: Create `RevisionHistoryPanel.tsx` component
  - [x] Subtask 5.2: Create `RevisionHistoryPanel.css` for styling
  - [x] Subtask 5.3: Implement revision list items inline in RevisionHistoryPanel (simplified from separate component)
  - [x] Subtask 5.4: Add "View History" button to EditorToolbar
  - [x] Subtask 5.5: Implement revision list with relative timestamps
  - [x] Subtask 5.6: Implement revision preview pane (read-only)
  - [x] Subtask 5.7: Add close button and Escape key handler
  - [x] Subtask 5.8: Add warning banner when revision count >5

- [x] Task 6: Implement Restore functionality (AC-4)
  - [x] Subtask 6.1: Add "Restore this version" button in preview pane
  - [x] Subtask 6.2: Show confirmation dialog before restore
  - [x] Subtask 6.3: Call `restore_revision` Tauri command
  - [x] Subtask 6.4: Update editor content with restored text via `setContent()`
  - [x] Subtask 6.5: Refresh revision list to show new "Restored" entry
  - [x] Subtask 6.6: Close history panel after successful restore

- [x] Task 7: Add tests (AC-1 through AC-7)
  - [x] Subtask 7.1: Test migration creates table with correct schema
  - [x] Subtask 7.2: Test `create_revision` inserts row correctly
  - [x] Subtask 7.3: Test `get_revisions` returns sorted list (newest first)
  - [x] Subtask 7.4: Test `restore_revision` creates new revision with correct type
  - [x] Subtask 7.5: Test auto-save creates revision (integration)
  - [x] Subtask 7.6: Test UI: history panel opens and closes
  - [x] Subtask 7.7: Test UI: revision selection shows preview
  - [x] Subtask 7.8: Test UI: restore updates editor content
  - [x] Subtask 7.9: Test warning appears when >5 revisions
  - [x] Subtask 7.10: Test keyboard navigation (Escape closes panel)

### Review Follow-ups (AI) — Fixed 2026-02-10

- [x] [AI-Review][HIGH] Fix XSS vulnerability: Added DOMPurify sanitization with allowlist [RevisionHistoryPanel.tsx]
- [x] [AI-Review][HIGH] Subtask 5.3 updated: Revision items rendered inline (simplified implementation)
- [x] [AI-Review][HIGH] AC-7 complete: Added onFocusEditor callback, editor.commands.focus() on close [ProposalEditor.tsx]
- [x] [AI-Review][MEDIUM] Empty state UI added when proposal has 0 revisions [RevisionHistoryPanel.tsx]
- [x] [AI-Review][MEDIUM] dateUtils.test.ts already in File List (frontmatter)
- [x] [AI-Review][MEDIUM] Future timestamps handled: Returns formatted date for negative diff [dateUtils.ts]
- [x] [AI-Review][MEDIUM] Preview content CSS fixed: Removed pre-wrap, added proper HTML styling [RevisionHistoryPanel.css]
- [x] [AI-Review][LOW] Body scroll lock implemented via document.body.style.overflow [RevisionHistoryPanel.tsx]
- [x] [AI-Review][LOW] Pagination deferred: Added comment noting future enhancement opportunity
- [x] [AI-Review][LOW] Close button touch target: Added 44x44px minimum size [RevisionHistoryPanel.css]

## Dev Notes

### Architecture Requirements

**FR-8: Rich Text Editor**
- Revisions store the full text content (not diffs)
- Each auto-save from TipTap creates a revision

**NFR-3: Performance**
- Revision queries complete in <100ms (indexed)
- History panel loads in <200ms
- No performance impact on normal editing

**Immutable Log Design**
- Revisions are append-only
- Restoration creates NEW revision (never overwrites)
- Deletion only via Story 6-8 (full proposal delete)
- Archiving only via Story 6-7 (after 5 revisions)

### Database Migration

```sql
-- V8__create_proposal_revisions_table.sql

-- Proposal revisions table for version history
-- Immutable append-only log (never delete directly)

CREATE TABLE proposal_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    content TEXT NOT NULL,

    -- Revision metadata
    revision_type TEXT NOT NULL DEFAULT 'edit'
        CHECK (revision_type IN ('generation', 'edit', 'restore')),
    restored_from_id INTEGER,  -- NULL unless revision_type = 'restore'

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Foreign keys
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
    FOREIGN KEY (restored_from_id) REFERENCES proposal_revisions(id)
);

-- Index for fast history queries (newest first)
CREATE INDEX idx_proposal_revisions_proposal_created
    ON proposal_revisions(proposal_id, created_at DESC);

-- Index for counting revisions per proposal
CREATE INDEX idx_proposal_revisions_proposal_id
    ON proposal_revisions(proposal_id);
```

### Rust Structs

```rust
// src-tauri/src/db/queries/revisions.rs

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Revision metadata for list display (without full content)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionSummary {
    pub id: i64,
    pub proposal_id: i64,
    pub revision_type: String,
    pub restored_from_id: Option<i64>,
    pub created_at: String,
    pub content_preview: String,  // First 50 chars
}

/// Full revision for preview/restore
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    conn.execute(
        "INSERT INTO proposal_revisions (proposal_id, content, revision_type, restored_from_id)
         VALUES (?1, ?2, ?3, ?4)",
        params![proposal_id, content, revision_type, restored_from_id],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

/// Get revision summaries for a proposal (newest first)
pub fn get_revisions(conn: &Connection, proposal_id: i64) -> Result<Vec<RevisionSummary>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, proposal_id, revision_type, restored_from_id, created_at,
                SUBSTR(content, 1, 50) as content_preview
         FROM proposal_revisions
         WHERE proposal_id = ?1
         ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let revisions = stmt.query_map(params![proposal_id], |row| {
        Ok(RevisionSummary {
            id: row.get(0)?,
            proposal_id: row.get(1)?,
            revision_type: row.get(2)?,
            restored_from_id: row.get(3)?,
            created_at: row.get(4)?,
            content_preview: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    revisions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
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
    ).map_err(|e| e.to_string())
}

/// Get revision count for warning threshold
pub fn get_revision_count(conn: &Connection, proposal_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM proposal_revisions WHERE proposal_id = ?1",
        params![proposal_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())
}
```

### Tauri Commands

```rust
// src-tauri/src/lib.rs (add to existing commands)

use crate::db::queries::revisions;

/// Create a revision (called on auto-save from TipTap)
#[tauri::command]
pub async fn create_revision(
    proposal_id: i64,
    content: String,
    revision_type: Option<String>,
    database: State<'_, Database>,
) -> Result<i64, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;
    let rev_type = revision_type.unwrap_or_else(|| "edit".to_string());

    revisions::create_revision(&conn, proposal_id, &content, &rev_type, None)
}

/// Get revision summaries for history panel
#[tauri::command]
pub async fn get_proposal_revisions(
    proposal_id: i64,
    database: State<'_, Database>,
) -> Result<Vec<revisions::RevisionSummary>, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;
    revisions::get_revisions(&conn, proposal_id)
}

/// Get full revision content for preview
#[tauri::command]
pub async fn get_revision_content(
    revision_id: i64,
    database: State<'_, Database>,
) -> Result<revisions::ProposalRevision, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;
    revisions::get_revision(&conn, revision_id)
}

/// Restore a previous revision
/// Creates a NEW revision with type='restore' and updates the proposal
#[tauri::command]
pub async fn restore_revision(
    proposal_id: i64,
    source_revision_id: i64,
    database: State<'_, Database>,
) -> Result<i64, String> {
    let conn = database.conn.lock().map_err(|e| e.to_string())?;

    // Get the source revision content
    let source = revisions::get_revision(&conn, source_revision_id)?;

    // Create new "restore" revision
    let new_revision_id = revisions::create_revision(
        &conn,
        proposal_id,
        &source.content,
        "restore",
        Some(source_revision_id),
    )?;

    // Update the proposal's current content
    conn.execute(
        "UPDATE proposals SET generated_text = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![source.content, proposal_id],
    ).map_err(|e| e.to_string())?;

    tracing::info!(
        proposal_id = proposal_id,
        source_revision_id = source_revision_id,
        new_revision_id = new_revision_id,
        "Restored proposal to previous revision"
    );

    Ok(new_revision_id)
}
```

### TypeScript Types

```typescript
// src/types/revisions.ts

export interface RevisionSummary {
  id: number;
  proposalId: number;
  revisionType: 'generation' | 'edit' | 'restore';
  restoredFromId: number | null;
  createdAt: string;  // ISO timestamp
  contentPreview: string;  // First 50 chars
}

export interface ProposalRevision {
  id: number;
  proposalId: number;
  content: string;
  revisionType: 'generation' | 'edit' | 'restore';
  restoredFromId: number | null;
  createdAt: string;
}
```

### Revision History Panel Component

```tsx
// src/components/RevisionHistoryPanel.tsx

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RevisionSummary, ProposalRevision } from '../types/revisions';
import { formatRelativeTime } from '../utils/dateUtils';
import './RevisionHistoryPanel.css';

interface Props {
  proposalId: number;
  onRestore: (content: string) => void;
  onClose: () => void;
}

export function RevisionHistoryPanel({ proposalId, onRestore, onClose }: Props) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<ProposalRevision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load revisions on mount
  useEffect(() => {
    async function loadRevisions() {
      try {
        const data = await invoke<RevisionSummary[]>('get_proposal_revisions', { proposalId });
        setRevisions(data);
      } catch (err) {
        setError(err as string);
      } finally {
        setIsLoading(false);
      }
    }
    loadRevisions();
  }, [proposalId]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load full revision content for preview
  const handleSelectRevision = useCallback(async (revisionId: number) => {
    try {
      const revision = await invoke<ProposalRevision>('get_revision_content', { revisionId });
      setSelectedRevision(revision);
    } catch (err) {
      setError(err as string);
    }
  }, []);

  // Restore selected revision
  const handleRestore = useCallback(async () => {
    if (!selectedRevision) return;

    const confirmed = window.confirm(
      'Restore this version? A new revision will be created with the restored content.'
    );
    if (!confirmed) return;

    try {
      await invoke('restore_revision', {
        proposalId,
        sourceRevisionId: selectedRevision.id,
      });
      onRestore(selectedRevision.content);
      onClose();
    } catch (err) {
      setError(err as string);
    }
  }, [selectedRevision, proposalId, onRestore, onClose]);

  const showWarning = revisions.length > 5;

  return (
    <div className="revision-history-panel" role="dialog" aria-label="Revision History">
      <div className="revision-history-header">
        <h2>Revision History</h2>
        <button onClick={onClose} aria-label="Close history panel">x</button>
      </div>

      {showWarning && (
        <div className="revision-warning">
          You have {revisions.length} revisions. Consider archiving older versions.
        </div>
      )}

      {isLoading && <div className="loading">Loading revisions...</div>}
      {error && <div className="error">{error}</div>}

      <div className="revision-history-content">
        {/* Revision list */}
        <div className="revision-list">
          {revisions.map((rev, index) => (
            <button
              key={rev.id}
              className={`revision-item ${selectedRevision?.id === rev.id ? 'selected' : ''}`}
              onClick={() => handleSelectRevision(rev.id)}
            >
              <span className="revision-time">{formatRelativeTime(rev.createdAt)}</span>
              <span className="revision-type">
                {index === 0 ? 'Current' : rev.revisionType}
                {rev.revisionType === 'restore' && ' (restored)'}
              </span>
              <span className="revision-preview">{rev.contentPreview}...</span>
            </button>
          ))}
        </div>

        {/* Preview pane */}
        {selectedRevision && (
          <div className="revision-preview-pane">
            <div className="preview-header">
              <span>Preview: {formatRelativeTime(selectedRevision.createdAt)}</span>
              {revisions[0]?.id !== selectedRevision.id && (
                <button onClick={handleRestore} className="restore-button">
                  Restore this version
                </button>
              )}
            </div>
            <div className="preview-content" aria-readonly="true">
              {selectedRevision.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Date Utility Function

```typescript
// src/utils/dateUtils.ts

export function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
```

### Integration with Auto-Save (Story 6-1 modification)

```typescript
// src/hooks/useProposalEditor.ts (modify existing hook)

// In the auto-save function, after updating the proposal:
const saveContent = useCallback(async (content: string) => {
  if (!currentProposalId) return;

  try {
    // Update proposal content (existing logic)
    await invoke('update_proposal_content', {
      proposalId: currentProposalId,
      content,
    });

    // Create revision (NEW for Story 6-3)
    await invoke('create_revision', {
      proposalId: currentProposalId,
      content,
      revisionType: 'edit',
    });

    setSaveStatus('saved');
  } catch (error) {
    console.error('Failed to save:', error);
    setSaveStatus('error');
  }
}, [currentProposalId]);
```

### CSS Styling

```css
/* src/components/RevisionHistoryPanel.css */

.revision-history-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 100;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.revision-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.revision-history-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.revision-history-header button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.revision-warning {
  background: var(--warning-bg);
  color: var(--warning-text);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.revision-history-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.revision-list {
  flex: 1;
  overflow-y: auto;
  border-bottom: 1px solid var(--border-color);
}

.revision-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}

.revision-item:hover {
  background: var(--bg-hover);
}

.revision-item.selected {
  background: var(--bg-active);
}

.revision-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.revision-type {
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0.25rem 0;
}

.revision-preview {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.revision-preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  font-size: 0.875rem;
}

.restore-button {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.restore-button:hover {
  background: var(--primary-hover);
}

.preview-content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background: var(--bg-readonly);
  font-family: inherit;
  white-space: pre-wrap;
}
```

### File Structure

```
upwork-researcher/
  src-tauri/
    migrations/
      V8__create_proposal_revisions_table.sql   # NEW: Migration
    src/
      db/
        queries/
          revisions.rs                           # NEW: DB operations
          mod.rs                                 # Add revisions module
      lib.rs                                     # Add Tauri commands
  src/
    types/
      revisions.ts                               # NEW: TypeScript types
    utils/
      dateUtils.ts                               # NEW: Relative time formatting
    components/
      RevisionHistoryPanel.tsx                   # NEW: History UI
      RevisionHistoryPanel.css                   # NEW: History styles
      RevisionHistoryPanel.test.tsx              # NEW: Component tests
      EditorToolbar.tsx                          # MODIFY: Add "View History" button
    hooks/
      useProposalEditor.ts                       # MODIFY: Create revision on save
```

### Testing Requirements

**Unit Tests (Rust):**

1. **Migration Tests:**
   - Test table creates with all columns
   - Test foreign key constraint (proposal must exist)
   - Test revision_type CHECK constraint
   - Test index exists on (proposal_id, created_at)

2. **Database Operation Tests:**
   - Test `create_revision` inserts row correctly
   - Test `create_revision` with all revision types
   - Test `get_revisions` returns newest first
   - Test `get_revisions` returns empty for new proposal
   - Test `get_revision` returns correct content
   - Test `get_revision_count` returns accurate count
   - Test restoration creates new revision with `restored_from_id`

3. **Integration Tests:**
   - Test `restore_revision` updates proposal AND creates revision
   - Test CASCADE delete (when proposal deleted, revisions deleted)

**Frontend Tests:**

1. **RevisionHistoryPanel Tests:**
   - Test renders loading state initially
   - Test renders revision list when loaded
   - Test clicking revision shows preview
   - Test "Current" label on newest revision
   - Test restore button calls command
   - Test Escape key closes panel
   - Test warning appears when >5 revisions

2. **Date Formatting Tests:**
   - Test "Just now" for <1 minute
   - Test "X minutes ago" for 1-59 minutes
   - Test "X hours ago" for 1-23 hours
   - Test "Yesterday at X:XX" for 24-48 hours
   - Test full date for older

3. **Auto-Save Integration:**
   - Test save creates revision
   - Test revision type is 'edit' for manual edits

### Scope Boundaries

**In Scope for Story 6.3:**
- Database migration for `proposal_revisions` table
- Rust CRUD operations for revisions
- Tauri commands for frontend access
- Revision history panel UI
- Preview and restore functionality
- Auto-save creates revision
- Warning when >5 revisions

**Out of Scope (Other Stories):**
- Automatic archiving of old revisions (Story 6-7)
- Deleting proposal with all revisions (Story 6-8)
- Creating initial revision on generation (should be done, but Story 0-x scope)
- Side-by-side diff view (future enhancement)
- Revision comments/labels (future enhancement)

### Dependencies

**Depends On:**
- **Story 6-1: TipTap Editor Integration** — Provides editor with auto-save
- **Story 1-2: Proposals Table Schema** — Provides proposals table
- **Database migration framework** (Story 1-11)

**Depended On By:**
- **Story 6-7: Archive Old Revisions** — Uses revision count, manages old revisions
- **Story 6-8: Delete Proposal & All Revisions** — CASCADE deletes revisions

### Performance Targets

- Revision list query: <100ms (indexed on proposal_id + created_at)
- History panel load: <200ms
- Create revision: <50ms (no blocking on UI)
- Preview content load: <50ms

### Initial Revision on Generation

**Important:** When a proposal is first generated (Story 0-2), the system should also create the first revision with `revision_type = 'generation'`. This ensures the original generated text is always recoverable. If this isn't handled in Epic 0, add a task here to backfill:

```rust
// After successful generation completes:
create_revision(conn, proposal_id, &generated_text, "generation", None)?;
```

### References

- [Source: epics-stories.md#Story 6.3: Proposal Revision History]
- [Source: architecture.md#FR-8: Rich Text Editor]
- [Story 6-1: TipTap Editor Integration — Provides auto-save]
- [Story 6-7: Archive Old Revisions — Consumes revisions]
- [Story 6-8: Delete Proposal & All Revisions — CASCADE behavior]
- [Round 5 Occam's Razor: Limit to 5 active revisions]

## Dev Agent Record

### Implementation Summary

**Date:** 2026-02-10  
**Agent:** Amelia (Dev Agent)  
**Status:** ✅ All tasks complete, ready for code review

**Implementation Details:**

1. **Database Layer** (Tasks 1-2)
   - Created V23 migration to extend V8 schema with `revision_type` and `restored_from_id` columns
   - Implemented `revisions.rs` module with full CRUD operations
   - Added validation for revision_type constraint ('generation', 'edit', 'restore')
   - Indexed (proposal_id, created_at DESC) for fast history queries

2. **Backend Commands** (Task 3)
   - `create_revision`: Creates new revision on auto-save or restore
   - `get_proposal_revisions`: Returns summary list for history panel
   - `get_revision_content`: Fetches full content for preview
   - `restore_revision`: Creates restore-type revision + updates proposal

3. **Auto-Save Integration** (Task 4)
   - Modified `useProposalEditor.ts` to call `create_revision` after save
   - Error handling: logs but doesn't block save on revision failure
   - Inherits 2-second debounce from Story 6-1

4. **UI Components** (Tasks 5-6)
   - `RevisionHistoryPanel.tsx`: Slide-in panel with list + preview pane
   - Date formatting: formatRelativeTime() for human-readable timestamps
   - TypeScript types: RevisionSummary, ProposalRevision
   - "View History" button added to EditorToolbar
   - Restore button with confirmation dialog
   - Warning banner when >5 revisions
   - Escape key closes panel

5. **Tests** (Task 7)
   - **Rust:** 11 tests (create, read, ordering, restore, CASCADE delete, validation)
   - **Migration:** 2 tests (V23 column addition, foreign key)
   - **Frontend:** 14 RevisionHistoryPanel tests + 7 dateUtils tests
   - **Total:** 34 tests passing

### Technical Decisions

- **V23 migration instead of modifying V8:** V8 already applied, so added columns via ALTER TABLE
- **Revision storage:** Full content snapshots (not diffs) for simplicity and reliability
- **Restore mechanism:** Creates new revision with `restored_from_id` link (immutable log)
- **Current revision label:** First item always shows "Current" regardless of type
- **Locale-safe date formatting:** Tests accept both US and UK date formats

### Deferred Items

- **Initial revision on generation:** Noted in Dev Notes but implementation deferred to Epic 0 review
- **Side-by-side diff view:** Out of scope (future enhancement)
- **Revision comments/labels:** Out of scope

### Files Changed

14 files modified/created:
- 1 migration (V23)
- 3 Rust modules (revisions.rs, lib.rs, mod.rs)
- 1 Rust test file (migration_v23_test.rs)
- 1 backend integration (useProposalEditor.ts)
- 2 TypeScript type files (revisions.ts, dateUtils.ts)
- 6 UI files (RevisionHistoryPanel + tests, ProposalEditor, EditorToolbar)

### Performance Notes

- Rust tests: 11 passing in <50ms
- Frontend tests: 21 passing in <2s
- Migration tests: 2 passing in <10ms
- All tests green on first run after fixes (timestamp resolution, locale handling)

