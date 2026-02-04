import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { useGenerationStore } from "../stores/useGenerationStore";
import "./DraftRecoveryModal.css";

interface DraftRecoveryModalProps {
  onContinue: (jobContent: string, generatedText: string) => void;
}

function DraftRecoveryModal({ onContinue }: DraftRecoveryModalProps) {
  const { draftRecovery, clearDraftRecovery } = useGenerationStore();

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

  // Keyboard accessibility: Enter to continue, Escape to discard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleContinue();
      } else if (e.key === "Escape") {
        handleDiscard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftRecovery]);

  // Truncate preview text for display
  const jobPreview = draftRecovery.jobContent.slice(0, 100) +
    (draftRecovery.jobContent.length > 100 ? "..." : "");
  const proposalPreview = draftRecovery.generatedText.slice(0, 150) +
    (draftRecovery.generatedText.length > 150 ? "..." : "");

  return (
    <div className="draft-recovery-modal__backdrop">
      <div className="draft-recovery-modal">
        <h2>Draft Recovered</h2>
        <p className="draft-recovery-modal__message">
          We found an incomplete proposal from your last session. Would you like to continue working on it?
        </p>

        <div className="draft-recovery-modal__preview">
          <strong>Job Post:</strong>
          <p className="draft-recovery-modal__job-preview">{jobPreview}</p>
          <strong>Your Draft:</strong>
          <p>{proposalPreview}</p>
        </div>

        <div className="draft-recovery-modal__actions">
          <button
            className="button button--primary"
            onClick={handleContinue}
            autoFocus
          >
            Continue Draft
          </button>
          <button
            className="button button--secondary"
            onClick={handleDiscard}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

export default DraftRecoveryModal;
