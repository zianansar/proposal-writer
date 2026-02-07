/**
 * Story 4a.4: Hidden Needs Display Component
 * AC-2: Display hidden needs with need + evidence
 * AC-4: Show "No hidden needs detected" for empty array
 */

import "./HiddenNeedsDisplay.css";

interface HiddenNeed {
  need: string;
  evidence: string;
}

interface HiddenNeedsDisplayProps {
  hiddenNeeds: HiddenNeed[];
}

function HiddenNeedsDisplay({ hiddenNeeds }: HiddenNeedsDisplayProps) {
  if (hiddenNeeds.length === 0) {
    return (
      <div className="hidden-needs-empty" role="status">
        No hidden needs detected
      </div>
    );
  }

  return (
    <div className="hidden-needs-container" role="list" aria-label="Hidden needs list">
      <ul className="hidden-needs-list">
        {hiddenNeeds.map((item, index) => (
          <li key={index} className="hidden-need-item">
            <div className="hidden-need-label">{item.need}</div>
            <div className="hidden-need-evidence">→ {item.evidence}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HiddenNeedsDisplay;
