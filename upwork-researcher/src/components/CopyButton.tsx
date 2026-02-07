import { useCallback } from "react";
import SafetyWarningModal from "./SafetyWarningModal";
import OverrideConfirmDialog from "./OverrideConfirmDialog";
import { useSafeCopy } from "../hooks/useSafeCopy";
import { getShortcutDisplay } from "../hooks/usePlatform";

interface CopyButtonProps {
  text: string;
  disabled?: boolean;
  /** Proposal ID for override tracking (Story 3.7) */
  proposalId?: number | null;
}

/**
 * Button that copies text to the system clipboard.
 * Shows "Copied!" confirmation for 2 seconds after successful copy.
 *
 * Story 3.1: Pre-flight perplexity analysis before copy.
 * Story 3.2: Safety warning modal with flagged sentences.
 * Story 3.9: Refactored to use useSafeCopy hook for keyboard shortcut reuse.
 * - Threshold: <180 = safe (proceed), ≥180 = risky (show warning)
 * - On analysis failure: allow copy (don't block user on API errors)
 */
function CopyButton({ text, disabled = false, proposalId }: CopyButtonProps) {
  const { state, actions } = useSafeCopy();
  const { analyzing, copied, error, showWarningModal, showOverrideConfirm, analysisResult } = state;
  const { triggerCopy, dismissWarning, showOverrideDialog, cancelOverride, confirmOverride } = actions;

  const handleCopy = useCallback(async () => {
    if (disabled || !text) return;
    await triggerCopy(text);
  }, [text, disabled, triggerCopy]);

  // Story 3.2: Handle "Edit Proposal" - close modal
  const handleEdit = useCallback(() => {
    dismissWarning();
    // TODO (Story 3.2, Task 3.3): Focus ProposalOutput editor
  }, [dismissWarning]);

  // Story 3.6: Handle "Override (Risky)" - show confirmation dialog
  const handleOverride = useCallback(() => {
    showOverrideDialog();
  }, [showOverrideDialog]);

  // Story 3.6: Handle cancel from override confirmation - return to SafetyWarningModal
  const handleOverrideCancel = useCallback(() => {
    cancelOverride();
  }, [cancelOverride]);

  // Story 3.6 + 3.7: Handle confirm override - copy to clipboard and record override
  const handleOverrideConfirm = useCallback(async () => {
    await confirmOverride(text, proposalId);
  }, [text, proposalId, confirmOverride]);

  // Story 3.9: Shortcut hint for tooltip
  const shortcutHint = getShortcutDisplay("copy");

  return (
    <>
      <div className="copy-button-container">
        <button
          type="button"
          className={`copy-button ${copied ? "copy-button--copied" : ""} ${analyzing ? "copy-button--analyzing" : ""}`}
          onClick={handleCopy}
          disabled={disabled || !text || analyzing}
          aria-label={
            analyzing
              ? "Checking safety..."
              : copied
              ? "Copied to clipboard"
              : "Copy to clipboard"
          }
          title={`Copy to clipboard (${shortcutHint})`}
        >
          {analyzing ? (
            <>
              <span className="copy-icon" aria-hidden="true">
                ⏳
              </span>
              Checking safety...
            </>
          ) : copied ? (
            <>
              <span className="copy-icon" aria-hidden="true">
                ✓
              </span>
              Copied!
            </>
          ) : (
            <>
              <span className="copy-icon" aria-hidden="true">
                📋
              </span>
              Copy to Clipboard
            </>
          )}
        </button>
        {error && (
          <span className="copy-error" role="alert">
            {error}
          </span>
        )}
      </div>

      {/* Story 3.2: Safety Warning Modal */}
      {showWarningModal && analysisResult && (
        <SafetyWarningModal
          score={analysisResult.score}
          threshold={analysisResult.threshold}
          flaggedSentences={analysisResult.flaggedSentences}
          onEdit={handleEdit}
          onOverride={handleOverride}
        />
      )}

      {/* Story 3.6: Override Confirmation Dialog */}
      {showOverrideConfirm && (
        <OverrideConfirmDialog
          onCancel={handleOverrideCancel}
          onConfirm={handleOverrideConfirm}
        />
      )}
    </>
  );
}

export default CopyButton;
