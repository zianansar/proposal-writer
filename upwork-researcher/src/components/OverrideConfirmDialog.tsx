import { useEffect, useRef } from "react";
import "./OverrideConfirmDialog.css";

interface OverrideConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Override Confirmation Dialog (Story 3.6)
 *
 * Final confirmation before copying a flagged proposal.
 * Displays clear warning about AI detection risks.
 *
 * Design decisions:
 * - Cancel button has autofocus (safety: default action is cancel, not confirm)
 * - Enter does NOT auto-confirm (safety: prevent accidental confirm)
 * - Escape key calls cancel
 */
function OverrideConfirmDialog({
  onCancel,
  onConfirm,
}: OverrideConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

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

  // Focus cancel button on mount (safety)
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="override-confirm__backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-describedby="override-confirm-desc"
    >
      <div className="override-confirm">
        <p id="override-confirm-desc" className="override-confirm__warning">
          <span aria-hidden="true">⚠️</span> This proposal may be detected as
          AI-generated.
        </p>
        <p className="override-confirm__consequence">
          Upwork may penalize your account.
        </p>
        <p className="override-confirm__question">
          <strong>Are you sure you want to copy it?</strong>
        </p>
        <div className="override-confirm__actions">
          <button
            ref={cancelButtonRef}
            className="override-confirm__button button--secondary"
            onClick={onCancel}
            autoFocus
          >
            Cancel
          </button>
          <button
            className="override-confirm__button button--danger"
            onClick={onConfirm}
          >
            Copy Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverrideConfirmDialog;
