import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import CopyButton from "./CopyButton";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import ProposalEditor from "./ProposalEditor";

interface ProposalOutputProps {
  proposal: string | null;
  loading: boolean;
  error: string | null;
  isSaved?: boolean;
  /** Proposal ID for override tracking (Story 3.7) and deletion (Story 6.8) */
  proposalId?: number | null;
  onRetry?: () => void;
  onSaveForLater?: () => void;
  /** Callback when proposal is deleted (Story 6.8) */
  onDelete?: () => void;
  /** Callback when proposal content changes in editor (Story 6.1) */
  onContentChange?: (content: string) => void;
  retryCount?: number;
  /** Enable TipTap rich text editor (Story 6.1) - only for saved proposals */
  enableEditor?: boolean;
}

function ProposalOutput({
  proposal,
  loading,
  error,
  isSaved = false,
  proposalId,
  onRetry,
  onSaveForLater,
  onDelete,
  onContentChange,
  retryCount = 0,
  enableEditor = false,
}: ProposalOutputProps) {
  // Story 6.8: Delete confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Story 6.8: Handle delete button click - show confirmation
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
    setDeleteError(null);
  }, []);

  // Story 6.8: Handle cancel - close dialog
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // Story 6.8: Handle confirm - delete proposal
  const handleDeleteConfirm = useCallback(async () => {
    if (!proposalId) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await invoke<{ success: boolean; message: string }>(
        "delete_proposal",
        { proposalId }
      );

      if (result.success) {
        setShowDeleteConfirm(false);
        // Notify parent to refresh/clear state
        onDelete?.();
      } else {
        setDeleteError(result.message);
      }
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete proposal"
      );
    } finally {
      setDeleting(false);
    }
  }, [proposalId, onDelete]);
  // Show streaming content with indicator while loading
  if (loading && proposal) {
    return (
      <div className="proposal-output proposal-output--streaming" aria-live="polite" aria-busy="true">
        <label>Generating Proposal...</label>
        <div className="proposal-text">
          {proposal}
          <span className="streaming-cursor" aria-hidden="true"></span>
        </div>
      </div>
    );
  }

  // Show loading indicator before any tokens arrive
  if (loading) {
    return (
      <div className="proposal-output proposal-output--loading" aria-live="polite" aria-busy="true">
        <p>Generating your proposal...</p>
      </div>
    );
  }

  // Show error with any partial content preserved
  if (error) {
    const MAX_RETRIES = 3;
    const canRetry = retryCount < MAX_RETRIES;

    return (
      <div className="proposal-output proposal-output--error" aria-live="assertive">
        <p className="error-message">{error}</p>
        <div className="error-actions">
          {canRetry && onRetry && (
            <button onClick={onRetry} className="button button--primary">
              Retry {retryCount > 0 && `(${retryCount}/${MAX_RETRIES})`}
            </button>
          )}
          {onSaveForLater && (
            <button onClick={onSaveForLater} className="button button--secondary">
              Save Job for Later
            </button>
          )}
        </div>
        {proposal && (
          <>
            <label>Partial Result (preserved)</label>
            <div className="proposal-text">{proposal}</div>
            <CopyButton text={proposal} proposalId={proposalId} />
          </>
        )}
      </div>
    );
  }

  if (!proposal) {
    return null;
  }

  // Story 6.1: Use TipTap editor for saved proposals when enabled
  const showEditor = enableEditor && proposalId && isSaved;

  return (
    <>
      <div className="proposal-output" aria-live="polite">
        <div className="proposal-header">
          <label>Generated Proposal</label>
          {isSaved && <span className="saved-indicator" aria-label="Saved to database">Saved</span>}
        </div>

        {/* Story 6.1: TipTap editor for saved proposals, plain text otherwise */}
        {showEditor ? (
          <ProposalEditor
            content={proposal}
            proposalId={proposalId}
            onContentChange={onContentChange}
          />
        ) : (
          <div className="proposal-text">{proposal}</div>
        )}

        <div className="proposal-actions">
          <CopyButton text={proposal} proposalId={proposalId} />
          {/* Story 6.8: Delete button - only show for saved proposals */}
          {isSaved && proposalId && (
            <button
              type="button"
              className="delete-button"
              onClick={handleDeleteClick}
              disabled={deleting}
              aria-label="Delete proposal"
            >
              {deleting ? "Deleting..." : "Delete Proposal"}
            </button>
          )}
        </div>
        {deleteError && (
          <p className="delete-error" role="alert">
            {deleteError}
          </p>
        )}
      </div>

      {/* Story 6.8: Delete confirmation dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}

export default ProposalOutput;
