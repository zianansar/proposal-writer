import { useEffect, useRef } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import "./OverrideConfirmDialog.css";

interface OverrideConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  /** Story 8.2: Element that triggered the modal (for focus return) */
  triggerRef?: React.RefObject<HTMLElement>;
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
function OverrideConfirmDialog({ onCancel, onConfirm, triggerRef }: OverrideConfirmDialogProps) {
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

  return (
    <div
      className="override-confirm__backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-describedby="override-confirm-desc"
    >
      <div ref={modalRef} className="override-confirm">
        <p id="override-confirm-desc" className="override-confirm__warning">
          <span aria-hidden="true">⚠️</span> This proposal may be detected as AI-generated.
        </p>
        <p className="override-confirm__consequence">Upwork may penalize your account.</p>
        <p className="override-confirm__question">
          <strong>Are you sure you want to copy it?</strong>
        </p>
        <div className="override-confirm__actions">
          <button className="override-confirm__button button--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="override-confirm__button button--danger" onClick={onConfirm}>
            Copy Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverrideConfirmDialog;
