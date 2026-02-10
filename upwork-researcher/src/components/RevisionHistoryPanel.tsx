// src/components/RevisionHistoryPanel.tsx
// Revision history UI for viewing and restoring previous versions (Story 6.3)

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import DOMPurify from 'dompurify';
import type { RevisionSummary, ProposalRevision, ArchivedRevision } from '../types/revisions';
import { formatRelativeTime } from '../utils/dateUtils';
import './RevisionHistoryPanel.css';

interface Props {
  proposalId: number;
  onRestore: (content: string) => void;
  onClose: () => void;
  /** Callback to return focus to editor after panel closes (AC-7) */
  onFocusEditor?: () => void;
}

export function RevisionHistoryPanel({ proposalId, onRestore, onClose, onFocusEditor }: Props) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<ProposalRevision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Story 6-7: Archived revisions state
  const [archivedRevisions, setArchivedRevisions] = useState<ArchivedRevision[]>([]);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [selectedArchived, setSelectedArchived] = useState<ArchivedRevision | null>(null);

  // Close panel and return focus to editor (AC-7)
  const handleClose = useCallback(() => {
    onClose();
    // Return focus to editor after panel closes
    onFocusEditor?.();
  }, [onClose, onFocusEditor]);

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

  // Load archived revisions (Story 6-7: AC3, AC5)
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

  // Body scroll lock when panel is open (L1)
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Load full revision content for preview
  // M1 fix: Clear archived selection when selecting active revision
  const handleSelectRevision = useCallback(async (revisionId: number) => {
    try {
      setSelectedArchived(null); // Clear archived selection to prevent dual preview
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
      handleClose();
    } catch (err) {
      setError(err as string);
    }
  }, [selectedRevision, proposalId, onRestore, handleClose]);

  // Restore from archived revision (Story 6-7: AC3)
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
      handleClose();
    } catch (err) {
      setError(err as string);
    }
  }, [selectedArchived, archivedRevisions, proposalId, onRestore, handleClose]);

  // Sanitize HTML content to prevent XSS (H1 fix)
  const sanitizeHtml = useCallback((html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: [],
    });
  }, []);

  const showWarning = revisions.length > 5;

  return (
    <div className="revision-history-panel" role="dialog" aria-label="Revision History" ref={panelRef}>
      <div className="revision-history-header">
        <h2>Revision History</h2>
        <button onClick={handleClose} className="close-button" aria-label="Close history panel">×</button>
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
          {/* Empty state when no revisions (M1) */}
          {!isLoading && revisions.length === 0 && (
            <div className="revision-empty">
              No revision history yet. Edits will appear here after you make changes.
            </div>
          )}
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

          {/* Archived revisions section (Story 6-7: AC3, AC5) */}
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
                  {archivedRevisions.map((rev) => (
                    <button
                      key={rev.id}
                      className={`revision-item archived ${selectedArchived?.id === rev.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedRevision(null); // M1 fix: Clear active selection to prevent dual preview
                        setSelectedArchived(rev);
                      }}
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
            {/* H1 fix: Sanitize HTML to prevent XSS */}
            <div
              className="preview-content"
              aria-readonly="true"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedRevision.content) }}
            />
          </div>
        )}

        {/* Archived revision preview pane (Story 6-7: AC3) */}
        {selectedArchived && (
          <div className="revision-preview-pane archived-preview">
            <div className="preview-header">
              <span>Archived: {formatRelativeTime(selectedArchived.createdAt)}</span>
              <button onClick={handleRestoreArchived} className="restore-button">
                Restore this version
              </button>
            </div>
            <div
              className="preview-content"
              aria-readonly="true"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedArchived.content) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
