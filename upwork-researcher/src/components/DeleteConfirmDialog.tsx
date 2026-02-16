import { useEffect, useRef } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import "./DeleteConfirmDialog.css";

interface DeleteConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  /** Story 8.2: Element that triggered the modal (for focus return) */
  triggerRef?: React.RefObject<HTMLElement>;
}

/**
 * Delete Confirmation Dialog (Story 6.8)
 *
 * Final confirmation before permanently deleting a proposal and all revisions.
 * Displays clear warning about irreversible action.
 *
 * Design decisions:
 * - Cancel button has autofocus (safety: default action is cancel, not delete)
 * - Enter does NOT auto-confirm (safety: prevent accidental deletion)
 * - Escape key calls cancel
 * - Body scroll locked while dialog is open
 * - GDPR compliance: implements "right to deletion" from Round 5 Security Audit
 */
function DeleteConfirmDialog({ onCancel, onConfirm, triggerRef }: DeleteConfirmDialogProps) {
  // Story 8.2: Focus trap for keyboard navigation
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { triggerRef });

  // Keyboard accessibility: Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Prevent body scroll while dialog is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      className="delete-confirm__backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      aria-describedby="delete-confirm-desc"
    >
      <div ref={modalRef} className="delete-confirm">
        <h2 id="delete-confirm-title" className="delete-confirm__title">
          Delete Proposal
        </h2>
        <p id="delete-confirm-desc" className="delete-confirm__warning">
          ⚠️ This will permanently delete the proposal and all revisions.
        </p>
        <p className="delete-confirm__consequence">This cannot be undone.</p>
        <div className="delete-confirm__actions">
          <button className="delete-confirm__button button--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="delete-confirm__button button--danger" onClick={onConfirm}>
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmDialog;
