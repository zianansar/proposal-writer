/**
 * JobScoreBadge Component (Story 4b.5 Task 4.1, Story 4b.6 Task 2.3)
 *
 * Displays overall job score with color-coded badge indicating priority level.
 * Uses component thresholds (not weighted average) for color determination.
 * Clickable to toggle scoring breakdown display (Story 4b.6).
 */

import "./JobScoreBadge.css";

export interface JobScoreBadgeProps {
  overallScore: number | null;
  colorFlag: "green" | "yellow" | "red" | "gray";
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function JobScoreBadge({
  overallScore,
  colorFlag,
  isExpanded = false,
  onToggle,
}: JobScoreBadgeProps) {
  // Display text based on state
  const getDisplayText = () => {
    if (overallScore === null) {
      return "Configure skills in Settings";
    }
    return `Overall: ${overallScore.toFixed(1)}`;
  };

  // Accessibility label
  const getAriaLabel = () => {
    if (overallScore === null) {
      return "Overall job score not available. Please configure your skills in Settings.";
    }
    const priorityText = colorFlag.charAt(0).toUpperCase() + colorFlag.slice(1);
    const expandText = onToggle ? ". Click for breakdown." : "";
    return `Overall job score: ${overallScore.toFixed(
      1,
    )} out of 100, ${priorityText} priority${expandText}`;
  };

  // Color name for display
  const getColorName = () => {
    switch (colorFlag) {
      case "green":
        return "Green";
      case "yellow":
        return "Yellow";
      case "red":
        return "Red";
      case "gray":
        return "Gray";
    }
  };

  // Story 4b.6: Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onToggle && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onToggle();
    }
    if (onToggle && e.key === "Escape" && isExpanded) {
      e.preventDefault();
      onToggle();
    }
  };

  // If no onToggle handler, render as non-interactive status (backward compatibility)
  if (!onToggle) {
    return (
      <div
        className={`job-score-badge job-score-badge--${colorFlag}`}
        role="status"
        aria-label={getAriaLabel()}
      >
        <span className="job-score-badge__text">{getDisplayText()}</span>
        {overallScore !== null && (
          <span className="job-score-badge__flag"> — {getColorName()}</span>
        )}
      </div>
    );
  }

  // Story 4b.6: Clickable badge with breakdown toggle
  return (
    <button
      type="button"
      className={`job-score-badge job-score-badge--${colorFlag} job-score-badge--clickable`}
      aria-expanded={isExpanded}
      aria-controls="scoring-breakdown"
      aria-label={getAriaLabel()}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <span className="job-score-badge__text">{getDisplayText()}</span>
      {overallScore !== null && (
        <>
          <span className="job-score-badge__flag"> — {getColorName()}</span>
          <span
            className={`job-score-badge__chevron ${isExpanded ? "job-score-badge__chevron--rotated" : ""}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </>
      )}
    </button>
  );
}
