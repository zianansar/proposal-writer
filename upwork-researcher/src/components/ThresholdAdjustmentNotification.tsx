import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./ThresholdAdjustmentNotification.css";

/**
 * Threshold suggestion returned by backend learning detection (Story 3.7).
 *
 * @property currentThreshold - User's current safety threshold setting
 * @property suggestedThreshold - Algorithm-recommended new threshold
 * @property successfulOverrideCount - Number of successful overrides in learning window
 * @property averageOverrideScore - Mean AI score of overridden proposals
 * @property direction - "increase" (raise threshold), "decrease" (lower it), or "at_maximum" (already at 220)
 */
export interface ThresholdSuggestion {
  currentThreshold: number;
  suggestedThreshold: number;
  successfulOverrideCount: number;
  averageOverrideScore: number;
  direction: "increase" | "decrease" | "at_maximum";
}

interface ThresholdAdjustmentNotificationProps {
  suggestion: ThresholdSuggestion;
  onAccept: (newThreshold: number) => void;
  onReject: () => void;
  onRemindLater: () => void;
}

/**
 * Threshold Adjustment Notification (Story 3.7, AC4)
 *
 * Displays when the learning algorithm detects a pattern:
 * - Increase: 3+ successful overrides within 10 points of threshold in 30 days
 * - Decrease: No overrides for 60 days with threshold above default (180)
 *
 * Non-blocking banner positioned at top of the app.
 * Persistent until user responds (accept/reject/remind later).
 */
function ThresholdAdjustmentNotification({
  suggestion,
  onAccept,
  onReject,
  onRemindLater,
}: ThresholdAdjustmentNotificationProps) {
  const [error, setError] = useState<string | null>(null);
  const isIncrease = suggestion.direction === "increase";
  const isAtMaximum = suggestion.direction === "at_maximum";
  const isApproachingMaximum = suggestion.direction === "increase" && suggestion.suggestedThreshold >= 220;

  // Keyboard accessibility: Escape to dismiss (remind later)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onRemindLater();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRemindLater]);

  const handleAccept = useCallback(async () => {
    setError(null);
    try {
      await invoke("apply_threshold_adjustment", {
        newThreshold: suggestion.suggestedThreshold,
      });
      onAccept(suggestion.suggestedThreshold);
    } catch (err) {
      console.error("Failed to apply threshold adjustment:", err);
      setError("Failed to update threshold. Please try again.");
    }
  }, [suggestion.suggestedThreshold, onAccept]);

  const handleReject = useCallback(async () => {
    setError(null);
    try {
      await invoke("dismiss_threshold_suggestion");
      onReject();
    } catch (err) {
      console.error("Failed to dismiss suggestion:", err);
      setError("Failed to save preference. Please try again.");
    }
  }, [onReject]);

  return (
    <div
      className="threshold-notification"
      role="alert"
      aria-live="polite"
      aria-labelledby="threshold-notification-title"
    >
      <div className="threshold-notification__content">
        <div className="threshold-notification__header">
          <span className="threshold-notification__icon" aria-hidden="true">
            {isAtMaximum ? "⚠️" : isIncrease ? "📈" : "📉"}
          </span>
          <h2 id="threshold-notification-title" className="threshold-notification__title">
            {isAtMaximum ? "Maximum Threshold Reached" : "Adjust Your Safety Threshold?"}
          </h2>
        </div>

        {isAtMaximum ? (
          <>
            <p className="threshold-notification__message">
              You're at the <strong>maximum safety threshold (220)</strong>.
              Consider lowering your threshold for better AI detection protection.
            </p>
            <div className="threshold-notification__thresholds">
              <div className="threshold-notification__threshold threshold-notification__threshold--current threshold-notification__threshold--max">
                <span className="threshold-notification__threshold-label">Current</span>
                <span className="threshold-notification__threshold-value">
                  {suggestion.currentThreshold}
                </span>
              </div>
            </div>
            <p className="threshold-notification__explanation">
              Higher thresholds mean less protection. The maximum exists to ensure some
              safety margin remains.
            </p>
          </>
        ) : isIncrease ? (
          <>
            <p className="threshold-notification__message">
              You've successfully used{" "}
              <strong>{suggestion.successfulOverrideCount} proposals</strong> that were
              flagged. Your risk tolerance may be higher than your current threshold.
            </p>
            <div className="threshold-notification__thresholds">
              <div className="threshold-notification__threshold threshold-notification__threshold--current">
                <span className="threshold-notification__threshold-label">Current</span>
                <span className="threshold-notification__threshold-value">
                  {suggestion.currentThreshold}
                </span>
              </div>
              <span className="threshold-notification__arrow" aria-hidden="true">
                →
              </span>
              <div className="threshold-notification__threshold threshold-notification__threshold--suggested">
                <span className="threshold-notification__threshold-label">Suggested</span>
                <span className="threshold-notification__threshold-value">
                  {suggestion.suggestedThreshold}
                </span>
              </div>
            </div>
            <p className="threshold-notification__explanation">
              This will reduce false warnings while maintaining safety.
            </p>
          </>
        ) : (
          <>
            <p className="threshold-notification__message">
              Your threshold hasn't been challenged recently. Would you like to
              lower it back to <strong>{suggestion.suggestedThreshold}</strong> for
              added protection?
            </p>
            <div className="threshold-notification__thresholds">
              <div className="threshold-notification__threshold threshold-notification__threshold--current">
                <span className="threshold-notification__threshold-label">Current</span>
                <span className="threshold-notification__threshold-value">
                  {suggestion.currentThreshold}
                </span>
              </div>
              <span className="threshold-notification__arrow" aria-hidden="true">
                →
              </span>
              <div className="threshold-notification__threshold threshold-notification__threshold--suggested">
                <span className="threshold-notification__threshold-label">Suggested</span>
                <span className="threshold-notification__threshold-value">
                  {suggestion.suggestedThreshold}
                </span>
              </div>
            </div>
            <p className="threshold-notification__explanation">
              Lowering your threshold provides more protection against AI detection.
            </p>
          </>
        )}

        {isApproachingMaximum && (
          <p className="threshold-notification__warning">
            You're approaching the maximum safety threshold (220). Consider keeping
            some protection.
          </p>
        )}

        {error && (
          <p className="threshold-notification__error" role="alert">
            {error}
          </p>
        )}

        <div className="threshold-notification__actions">
          {isAtMaximum ? (
            <button
              className="threshold-notification__button threshold-notification__button--secondary"
              onClick={onRemindLater}
              autoFocus
            >
              Got It
            </button>
          ) : (
            <>
              <button
                className="threshold-notification__button threshold-notification__button--primary"
                onClick={handleAccept}
                autoFocus
              >
                Yes, {isIncrease ? "Adjust" : "Lower"} to {suggestion.suggestedThreshold}
              </button>
              <button
                className="threshold-notification__button threshold-notification__button--secondary"
                onClick={handleReject}
              >
                No, Keep {suggestion.currentThreshold}
              </button>
              <button
                className="threshold-notification__button threshold-notification__button--tertiary"
                onClick={onRemindLater}
              >
                Remind Me Later
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ThresholdAdjustmentNotification;
