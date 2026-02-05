import { useState, useCallback } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";
import type { PerplexityAnalysis } from "../types/perplexity";
import SafetyWarningModal from "./SafetyWarningModal";

interface CopyButtonProps {
  text: string;
  disabled?: boolean;
}

/**
 * Button that copies text to the system clipboard.
 * Shows "Copied!" confirmation for 2 seconds after successful copy.
 *
 * Story 3.1: Pre-flight perplexity analysis before copy.
 * Story 3.2: Safety warning modal with flagged sentences.
 * - Threshold: <180 = safe (proceed), ≥180 = risky (show warning)
 * - On analysis failure: allow copy (don't block user on API errors)
 */
function CopyButton({ text, disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<PerplexityAnalysis | null>(null);

  const handleCopy = useCallback(async () => {
    if (disabled || !text) return;

    try {
      // Story 3.1 + 3.2: Pre-flight perplexity analysis (FR-11)
      setAnalyzing(true);
      setError(null);

      let analysis: PerplexityAnalysis;
      try {
        analysis = await invoke<PerplexityAnalysis>("analyze_perplexity", {
          text,
        });
      } catch (analysisErr) {
        // On analysis failure, allow copy (don't block user on API errors)
        console.warn(
          "Perplexity analysis failed, allowing copy:",
          analysisErr
        );
        await writeText(text);
        setCopied(true);
        setAnalyzing(false);

        setTimeout(() => {
          setCopied(false);
        }, 2000);
        return;
      }

      setAnalyzing(false);

      // Threshold check: <180 = safe, ≥180 = risky
      if (analysis.score < analysis.threshold) {
        // Safe to copy
        await writeText(text);
        setCopied(true);
        setError(null);

        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        // AI detection risk too high - show warning modal (Story 3.2)
        setAnalysisResult(analysis);
        setShowWarningModal(true);
      }
    } catch (err) {
      setAnalyzing(false);
      setError("Failed to copy to clipboard");
      console.error("Clipboard write failed:", err);
    }
  }, [text, disabled]);

  // Story 3.2: Handle "Edit Proposal" - close modal
  const handleEdit = useCallback(() => {
    setShowWarningModal(false);
    setAnalysisResult(null);
    setError(null);
    // TODO (Story 3.2, Task 3.3): Focus ProposalOutput editor
    // This will be implemented when ProposalOutput ref is available
  }, []);

  // Story 3.2: Handle "Override (Risky)" - copy despite warning
  const handleOverride = useCallback(async () => {
    setShowWarningModal(false);
    setAnalysisResult(null);

    // Story 3.6: Override flow (stub for now)
    // TODO: Implement full override confirmation dialog in Story 3.6
    console.log("Override safety warning - copying proposal");

    try {
      await writeText(text);
      setCopied(true);
      setError(null);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
      console.error("Clipboard write failed:", err);
    }
  }, [text]);

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
    </>
  );
}

export default CopyButton;
