import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import { useGenerationStore } from "../stores/useGenerationStore";
import "./DraftRecoveryModal.css";

interface DraftRecoveryModalProps {
  onContinue: (jobContent: string, generatedText: string) => void;
  /** Story 8.2: Element that triggered the modal (for focus return) */
  triggerRef?: React.RefObject<HTMLElement>;
}

function DraftRecoveryModal({ onContinue, triggerRef }: DraftRecoveryModalProps) {
  const { draftRecovery, clearDraftRecovery } = useGenerationStore();

  // Story 8.2: Focus trap for keyboard navigation
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { triggerRef });

  // Keyboard accessibility: Enter to continue, Escape to discard
  // (must be before early return to satisfy rules-of-hooks)
  useEffect(() => {
    if (!draftRecovery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        onContinue(draftRecovery.jobContent, draftRecovery.generatedText);
        clearDraftRecovery();
      } else if (e.key === "Escape") {
        invoke("update_proposal_status", {
          proposalId: draftRecovery.id,
          status: "completed",
        })
          .catch((err) => {
            console.error("Failed to discard draft:", err);
          })
          .finally(() => clearDraftRecovery());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftRecovery, onContinue, clearDraftRecovery]);

  if (!draftRecovery) {
    return null;
  }

  const handleContinue = () => {
    // Pass draft content to parent, then clear recovery state
    onContinue(draftRecovery.jobContent, draftRecovery.generatedText);
    clearDraftRecovery();
  };

  const handleDiscard = async () => {
    try {
      // Mark draft as completed so it won't appear again
      await invoke("update_proposal_status", {
        proposalId: draftRecovery.id,
        status: "completed",
      });
      clearDraftRecovery();
    } catch (err) {
      console.error("Failed to discard draft:", err);
      // Still clear UI state even if backend fails
      clearDraftRecovery();
    }
  };

  // Truncate preview text for display
  const jobPreview =
    draftRecovery.jobContent.slice(0, 100) + (draftRecovery.jobContent.length > 100 ? "..." : "");
  const proposalPreview =
    draftRecovery.generatedText.slice(0, 150) +
    (draftRecovery.generatedText.length > 150 ? "..." : "");

  return (
    <div className="draft-recovery-modal__backdrop">
      <div
        ref={modalRef}
        className="draft-recovery-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-recovery-title"
      >
        <h2 id="draft-recovery-title">Draft Recovered</h2>
        <p className="draft-recovery-modal__message">
          We found an incomplete proposal from your last session. Would you like to continue working
          on it?
        </p>

        <div className="draft-recovery-modal__preview">
          <strong>Job Post:</strong>
          <p className="draft-recovery-modal__job-preview">{jobPreview}</p>
          <strong>Your Draft:</strong>
          <p>{proposalPreview}</p>
        </div>

        <div className="draft-recovery-modal__actions">
          <button className="button button--primary" onClick={handleContinue}>
            Continue Draft
          </button>
          <button className="button button--secondary" onClick={handleDiscard}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

export default DraftRecoveryModal;
