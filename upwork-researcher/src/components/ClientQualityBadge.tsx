/**
 * Story 4b.3: Client Quality Score Display
 *
 * AC-2: Color-coded badge showing client quality score (0-100)
 * - Green (>=80): #10b981 — High-quality client likely
 * - Yellow (60-79): #f59e0b — Medium quality, proceed with caution
 * - Red (<60): #ef4444 — Low quality, high risk
 * NFR-14: Accessible with aria-label, tooltip, and warning badge
 */

import "./ClientQualityBadge.css";

interface ClientQualityBadgeProps {
  score: number | null;
}

/** Get color class based on score threshold (AC-2) */
function getColorClass(score: number): string {
  if (score >= 80) return "client-quality--green";
  if (score >= 60) return "client-quality--yellow";
  return "client-quality--red";
}

/** Get qualitative label for accessibility (NFR-14) */
function getQualityLabel(score: number): string {
  if (score >= 80) return "high quality";
  if (score >= 60) return "medium quality";
  return "high risk";
}

export default function ClientQualityBadge({ score }: ClientQualityBadgeProps) {
  // AC-2: Null score → "Not available"
  if (score === null) {
    return (
      <div
        className="client-quality client-quality--null"
        data-testid="client-quality-badge"
        aria-label="Client quality score: Not available"
      >
        <span className="client-quality__message">Not available</span>
      </div>
    );
  }

  const colorClass = getColorClass(score);
  const qualityLabel = getQualityLabel(score);
  const isHighRisk = score < 60;

  return (
    <div
      className={`client-quality ${colorClass}`}
      data-testid="client-quality-badge"
      aria-label={`Client quality score: ${score}, ${qualityLabel}`}
      title="Estimated quality based on job post signals. 80+ = high quality, 60-79 = medium, <60 = high risk"
      tabIndex={0}
      role="status"
    >
      <span className="client-quality__label">Client Quality:</span>
      <span className="client-quality__value">{score}</span>
      {isHighRisk && (
        <span className="client-quality__warning">
          <span aria-hidden="true">⚠️</span> High risk client
        </span>
      )}
    </div>
  );
}
