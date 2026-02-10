import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import SafetyWarningModal from "./SafetyWarningModal";
import OverrideConfirmDialog from "./OverrideConfirmDialog";
import { useSafeCopy } from "../hooks/useSafeCopy";
import { getShortcutDisplay } from "../hooks/usePlatform";
import { useAnnounce } from "./LiveAnnouncer";

interface CopyButtonProps {
  /** Static text to copy (fallback if no getContent) */
  text: string;
  /** Dynamic content getter for edited proposals (Story 6.6) */
  getContent?: () => string;
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
 * Story 6.6: Dynamic content via getContent callback for edited proposals.
 * - Threshold: <180 = safe (proceed), ≥180 = risky (show warning)
 * - On analysis failure: allow copy (don't block user on API errors)
 */
function CopyButton({ text, getContent, disabled = false, proposalId }: CopyButtonProps) {
  const { state, actions } = useSafeCopy();
  const { analyzing, copied, error, showWarningModal, showOverrideConfirm, analysisResult } = state;
  const { triggerCopy, dismissWarning, showOverrideDialog, cancelOverride, confirmOverride } = actions;

  // Story 8.3 AC3: Announce clipboard copy
  const announce = useAnnounce();

  useEffect(() => {
    if (copied) {
      announce('Copied to clipboard');
    }
  }, [copied, announce]);

  // Story 8.6 AC4: Increment proposals edited count when copying edited content
  // Track previous copied state to detect transitions
  const prevCopiedRef = useRef(false);

  useEffect(() => {
    // Only increment if:
    // 1. Copy just succeeded (copied changed from false to true)
    // 2. getContent is provided (indicates edited proposal, not initial generation)
    if (copied && !prevCopiedRef.current && getContent) {
      invoke<number>('increment_proposals_edited')
        .catch((err) => {
          // Silent failure for non-critical tracking - don't block user workflow
          console.error('Failed to increment proposals edited count:', err);
        });
    }
    prevCopiedRef.current = copied;
  }, [copied, getContent]);

  const handleCopy = useCallback(async () => {
    // Story 6.6: Use dynamic content if available, otherwise static text
    const contentToCopy = getContent ? getContent() : text;
    if (disabled || !contentToCopy) return;
    await triggerCopy(contentToCopy);
  }, [text, getContent, disabled, triggerCopy]);

  // Story 6.6 AC5: Button enabled if getContent available OR text available
  const hasContent = getContent || text;

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
    // Story 6.6: Use dynamic content if available
    const contentToCopy = getContent ? getContent() : text;
    await confirmOverride(contentToCopy, proposalId);
  }, [text, getContent, proposalId, confirmOverride]);

  // Story 3.9: Shortcut hint for tooltip
  const shortcutHint = getShortcutDisplay("copy");

  return (
    <>
      <div className="copy-button-container">
        <button
          type="button"
          className={`copy-button ${copied ? "copy-button--copied" : ""} ${analyzing ? "copy-button--analyzing" : ""}`}
          onClick={handleCopy}
          disabled={disabled || !hasContent || analyzing}
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
