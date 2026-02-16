import { useEffect, useRef } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import type { HumanizationIntensity } from "../stores/useSettingsStore";
import type { FlaggedSentence } from "../types/perplexity";
import "./SafetyWarningModal.css";

const INTENSITY_LABELS: Record<HumanizationIntensity, string> = {
  off: "Off",
  light: "Light (0.5-1/100w)",
  medium: "Medium (1-2/100w)",
  heavy: "Heavy (2-3/100w)",
};

interface SafetyWarningModalProps {
  score: number;
  threshold: number;
  flaggedSentences: FlaggedSentence[];
  onEdit: () => void;
  onOverride: () => void;
  /** Story 3.3: Current humanization intensity (optional for backwards compat) */
  humanizationIntensity?: HumanizationIntensity;
  /** Story 3.3: Callback when user adjusts intensity from warning screen */
  onIntensityChange?: (intensity: HumanizationIntensity) => void;
  /** Story 3.4: Callback to regenerate with escalated humanization */
  onRegenerate?: () => void;
  /** Story 3.4: Current regeneration attempt (1-indexed) */
  attemptCount?: number;
  /** Story 3.4: Previous score for comparison */
  previousScore?: number;
  /** Story 3.4: Loading state during regeneration */
  isRegenerating?: boolean;
  /** Story 8.2: Element that triggered the modal (for focus return) */
  triggerRef?: React.RefObject<HTMLElement>;
}

/**
 * Safety Warning Modal (Story 3.2)
 *
 * Displays AI detection risk warning when perplexity score ≥ threshold (180).
 * Shows flagged sentences with specific humanization suggestions.
 *
 * Actions:
 * - Edit Proposal: Closes modal and focuses ProposalOutput editor
 * - Override (Risky): Proceeds with copy despite warning (Story 3.6)
 */
function SafetyWarningModal({
  score,
  threshold,
  flaggedSentences,
  onEdit,
  onOverride,
  humanizationIntensity,
  onIntensityChange,
  onRegenerate,
  attemptCount = 0,
  previousScore,
  isRegenerating = false,
  triggerRef,
}: SafetyWarningModalProps) {
  const MAX_ATTEMPTS = 3;
  const isAtMaxIntensity = humanizationIntensity === "heavy";
  const isAtMaxAttempts = attemptCount >= MAX_ATTEMPTS;
  const canShowRegenerateButton = !isAtMaxIntensity && !isAtMaxAttempts;

  // Story 8.2: Focus trap for keyboard navigation
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, { triggerRef });

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEdit(); // Escape = close and edit
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEdit]);

  return (
    <div
      className="safety-warning-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-warning-title"
    >
      <div ref={modalRef} className="safety-warning-modal">
        <h2 id="safety-warning-title" className="safety-warning-modal__title">
          <span className="safety-warning-modal__icon" aria-hidden="true">
            ⚠️
          </span>{" "}
          AI Detection Risk Detected
        </h2>

        <p className="safety-warning-modal__score">
          Perplexity score: <strong>{score.toFixed(1)}</strong> (threshold: {threshold})
          {previousScore && attemptCount > 0 && (
            <span className="safety-warning-modal__score-comparison">
              {" "}
              (Previous: {previousScore.toFixed(1)} →{" "}
              {score < previousScore ? "✓ Improved" : "⚠ No improvement"})
            </span>
          )}
        </p>

        {/* Story 3.3 AC7: Display current humanization intensity */}
        {humanizationIntensity && (
          <div className="safety-warning-modal__humanization">
            <span className="safety-warning-modal__humanization-label">
              Humanization: <strong>{INTENSITY_LABELS[humanizationIntensity]}</strong>
            </span>
            {onIntensityChange && (
              <select
                className="safety-warning-modal__intensity-select"
                value={humanizationIntensity}
                onChange={(e) => onIntensityChange(e.target.value as HumanizationIntensity)}
                aria-label="Adjust humanization intensity"
              >
                <option value="off">Off</option>
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="heavy">Heavy</option>
              </select>
            )}
          </div>
        )}

        <p className="safety-warning-modal__message">
          Parts of your proposal may be flagged as AI-generated. Review and fix the highlighted
          sentences below:
        </p>

        <div className="safety-warning-modal__flagged-sentences">
          {flaggedSentences.map((sentence, idx) => (
            <div key={idx} className="flagged-sentence">
              <div className="flagged-sentence__text">{sentence.text}</div>
              <div className="flagged-sentence__suggestion">
                <strong>Suggestion:</strong> {sentence.suggestion}
              </div>
            </div>
          ))}
        </div>

        {/* Story 3.4: Regenerate with more humanization */}
        {onRegenerate && humanizationIntensity && (
          <div className="safety-warning-modal__regenerate-section">
            {canShowRegenerateButton ? (
              <>
                <p className="safety-warning-modal__regenerate-description">
                  Try regenerating with stronger humanization to reduce AI detection risk.
                </p>
                <button
                  className="safety-warning-modal__button button--secondary button--regenerate"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    "Regenerating..."
                  ) : (
                    <>
                      Regenerate with More Humanization
                      {attemptCount > 0 && (
                        <span className="attempt-counter">
                          {" "}
                          (Attempt {attemptCount + 1} of {MAX_ATTEMPTS})
                        </span>
                      )}
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="safety-warning-modal__max-attempts-message">
                {isAtMaxIntensity && !isAtMaxAttempts && (
                  <p>
                    ℹ️ Already at maximum humanization intensity (Heavy). Consider manual editing.
                  </p>
                )}
                {isAtMaxAttempts && (
                  <p>
                    ⚠️ Maximum regeneration attempts ({MAX_ATTEMPTS}) reached. Please edit the
                    proposal manually using the suggestions above.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="safety-warning-modal__actions">
          <button
            className="safety-warning-modal__button button--primary button--edit"
            onClick={onEdit}
          >
            Edit Proposal
          </button>
          <button
            className="safety-warning-modal__button button--danger button--override"
            onClick={onOverride}
          >
            Override (Risky)
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafetyWarningModal;
