/// Story 4a.6: Job Analysis Loading State
/// Timer-based progress indicator for job analysis pipeline

import "./AnalysisProgress.css";

export type AnalysisStage = "idle" | "analyzing" | "extracting" | "complete" | "saved" | "error";

export interface AnalysisProgressProps {
  stage: AnalysisStage;
  errorMessage?: string;
}

/**
 * Displays staged progress messages during job analysis.
 * Uses timer-based transitions (not backend events) since analysis
 * is a single <3s API call with no meaningful intermediate stages.
 */
function AnalysisProgress({ stage, errorMessage }: AnalysisProgressProps) {
  // AC-1.3: Return null when idle
  if (stage === "idle") {
    return null;
  }

  // Determine message and styling based on stage
  const getContent = () => {
    switch (stage) {
      case "analyzing":
        return (
          <>
            <span className="analysis-progress__dot" aria-hidden="true" />
            <span>Analyzing job post...</span>
          </>
        );
      case "extracting":
        return (
          <>
            <span className="analysis-progress__dot" aria-hidden="true" />
            <span>Extracting details...</span>
          </>
        );
      case "complete":
        return (
          <span className="analysis-progress__complete">
            <span className="analysis-progress__checkmark" role="img" aria-label="success">✓</span>
            <span>Complete</span>
          </span>
        );
      case "saved":
        return (
          <span className="analysis-progress__saved">
            <span className="analysis-progress__checkmark" role="img" aria-label="saved">✓</span>
            <span>Saved</span>
          </span>
        );
      case "error":
        return (
          <span className="analysis-progress__error">
            {errorMessage || "Analysis failed"}
          </span>
        );
      default:
        return null;
    }
  };

  const isInProgress = stage === "analyzing" || stage === "extracting";

  return (
    <div
      className={`analysis-progress analysis-progress--${stage}`}
      role="status"
      aria-live="polite"
      aria-busy={isInProgress}
      data-testid="analysis-progress"
    >
      {getContent()}
    </div>
  );
}

export default AnalysisProgress;
