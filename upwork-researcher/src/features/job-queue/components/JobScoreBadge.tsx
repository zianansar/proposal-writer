/**
 * Job Score Badge Component - Story 4b.9
 * Circular badge with score number and colored background (AC-2)
 */

import type { ScoreColor } from '../types';
import './JobScoreBadge.css';

interface JobScoreBadgeProps {
  score: number | null;
  color: ScoreColor;
  size?: 'sm' | 'lg';
}

/**
 * AC-7.2: Circular badge with score number and colored background
 * AC-7.3: Colors - Green (#22c55e), Yellow (#eab308), Red (#ef4444), Gray (#6b7280)
 * AC-7.4: Size variants - sm (list view), lg (detail view)
 * AC-7.5: Accessibility - role="status", descriptive aria-label
 * AC-7.6: Handle null score - display "—" with Gray background
 */
export default function JobScoreBadge({ score, color, size = 'sm' }: JobScoreBadgeProps) {
  // AC-7.5: Descriptive aria-label
  const ariaLabel = score !== null
    ? `Score: ${score.toFixed(1)}, ${getColorDescription(color)}`
    : 'Not yet scored';

  // AC-7.6: Display "—" for null scores
  const displayValue = score !== null ? score.toFixed(1) : '—';

  return (
    <div
      className={`score-badge score-badge-${size} score-${color}`}
      role="status"
      aria-label={ariaLabel}
    >
      <span className="score-value">{displayValue}</span>
    </div>
  );
}

function getColorDescription(color: ScoreColor): string {
  switch (color) {
    case 'green':
      return 'good match';
    case 'yellow':
      return 'moderate match';
    case 'red':
      return 'poor match';
    case 'gray':
      return 'not scored';
  }
}
