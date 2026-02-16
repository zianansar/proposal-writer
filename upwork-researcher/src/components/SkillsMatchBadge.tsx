/**
 * Story 4b.2: Skills Match Percentage Display
 *
 * AC-2: Color-coded badge showing skills match percentage
 * AC-3: Edge case messages for null results
 * NFR-14: Accessible with aria-label and keyboard-focusable tooltip
 */

import "./SkillsMatchBadge.css";

interface SkillsMatchBadgeProps {
  percentage: number | null;
  matchedCount?: number;
  totalCount?: number;
  reason?: "no-user-skills" | "no-job-skills" | null;
}

/** Get color class based on percentage threshold (AC-2) */
function getColorClass(percentage: number): string {
  if (percentage >= 75) return "skills-match--green";
  if (percentage >= 50) return "skills-match--yellow";
  return "skills-match--red";
}

/** Get qualitative fit label for accessibility (NFR-14) */
function getFitLabel(percentage: number): string {
  if (percentage >= 75) return "strong fit";
  if (percentage >= 50) return "moderate fit";
  return "weak fit";
}

export default function SkillsMatchBadge({
  percentage,
  matchedCount,
  totalCount,
  reason,
}: SkillsMatchBadgeProps) {
  // AC-3: No user skills configured
  if (reason === "no-user-skills") {
    return (
      <div className="skills-match skills-match--null" data-testid="skills-match-badge">
        <span className="skills-match__message">
          Configure your skills in Settings to see match percentage
        </span>
      </div>
    );
  }

  // AC-3: No job skills extracted
  if (reason === "no-job-skills") {
    return (
      <div className="skills-match skills-match--null" data-testid="skills-match-badge">
        <span className="skills-match__message">No skills detected in job post</span>
      </div>
    );
  }

  // AC-3: Null percentage (shouldn't happen if reason is set, but defensive)
  if (percentage === null) {
    return null;
  }

  // L2 Review Fix: Guard against NaN/Infinity from bad backend data
  if (!Number.isFinite(percentage)) {
    return null;
  }

  const colorClass = getColorClass(percentage);
  const fitLabel = getFitLabel(percentage);
  const tooltipText =
    matchedCount !== undefined && totalCount !== undefined
      ? `${matchedCount} of ${totalCount} required skills matched`
      : `Skills match: ${percentage}%`;

  return (
    <div
      className={`skills-match ${colorClass}`}
      data-testid="skills-match-badge"
      aria-label={`Skills match percentage: ${percentage}%, ${fitLabel}`}
      title={tooltipText}
      tabIndex={0}
      role="status"
    >
      <span className="skills-match__label">Skills Match:</span>
      <span className="skills-match__value">{percentage}%</span>
    </div>
  );
}
