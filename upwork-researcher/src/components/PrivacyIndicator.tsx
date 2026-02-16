import { useState, useEffect, useRef, useId } from "react";
import "./PrivacyIndicator.css";

export type PrivacyIndicatorVariant = "golden-set" | "compact" | "settings";

interface PrivacyIndicatorProps {
  variant?: PrivacyIndicatorVariant;
  expandable?: boolean;
  className?: string;
  /** Callback when settings variant delete link is clicked */
  onDeleteClick?: () => void;
}

const VARIANT_CONTENT = {
  "golden-set": {
    headline: "Your proposals never leave your device",
    description:
      "We analyze your writing style locally and only send statistical parameters (like tone and length) to the AI. Your actual proposal text stays on your computer.",
    showExpandable: true,
  },
  compact: {
    headline: "Your proposals stay on your device",
    description: "Only style patterns are used for generation.",
    showExpandable: false,
  },
  settings: {
    headline: "Your proposals never leave your device",
    description: "All analysis happens locally. You can delete all data anytime.",
    showExpandable: true,
  },
};

export function PrivacyIndicator({
  variant = "golden-set",
  expandable = true,
  className = "",
  onDeleteClick,
}: PrivacyIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // L7 fix: Runtime safety for invalid variant
  const content = VARIANT_CONTENT[variant] ?? VARIANT_CONTENT["golden-set"];
  const canExpand = expandable && content.showExpandable;
  const containerRef = useRef<HTMLDivElement>(null);
  const detailsId = useId();

  // H1 fix: Click outside to close expanded view (AC-2)
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  return (
    <div
      ref={containerRef}
      className={`privacy-indicator privacy-indicator--${variant} ${className}`}
    >
      <div className="privacy-indicator__header">
        <span className="privacy-indicator__icon" aria-hidden="true">
          🔒
        </span>
        <div className="privacy-indicator__content">
          <p className="privacy-indicator__headline">{content.headline}</p>
          <p className="privacy-indicator__description">
            {content.description}
            {/* H2 fix: Settings variant delete link (AC-4) */}
            {variant === "settings" && onDeleteClick && (
              <>
                {" "}
                <button
                  type="button"
                  className="privacy-indicator__delete-link"
                  onClick={onDeleteClick}
                  aria-label="Delete all voice data"
                >
                  Delete your data
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {canExpand && (
        <button
          className="privacy-indicator__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
        >
          {isExpanded ? "Collapse ▲" : "How does this work?"}
        </button>
      )}

      {isExpanded && (
        <div
          id={detailsId}
          className="privacy-indicator__details"
          role="region"
          aria-label="Privacy details"
        >
          <div className="privacy-indicator__section">
            <p className="privacy-indicator__section-title">
              <span aria-hidden="true">📊</span> What We Analyze Locally:
            </p>
            <ul>
              <li>Sentence length patterns (average words per sentence)</li>
              <li>Tone and formality level (professional vs casual)</li>
              <li>Structure preferences (paragraphs vs bullet points)</li>
              <li>Vocabulary complexity (technical depth)</li>
              <li>Common phrases you use</li>
            </ul>
          </div>

          <div className="privacy-indicator__section">
            <p className="privacy-indicator__section-title">
              <span aria-hidden="true">📤</span> What Gets Sent to AI:
            </p>
            <ul>
              <li>Style parameters only (numbers like "tone: 7/10")</li>
              <li>Never your actual proposal text</li>
              <li>Never client names or project details</li>
            </ul>
          </div>

          <div className="privacy-indicator__section">
            <p className="privacy-indicator__section-title">
              <span aria-hidden="true">🗑️</span> Your Data:
            </p>
            <ul>
              <li>Stored in encrypted local database (SQLCipher)</li>
              <li>Delete anytime from Settings → Data Management</li>
              <li>Zero telemetry - we never track your usage</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrivacyIndicator;
