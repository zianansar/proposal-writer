/**
 * Story 5.2: Hook Strategy Card Component
 *
 * AC-1: Display strategy name, description, first example, and "best for" tag
 * AC-3: Interactive selection with visual feedback (hover, selected states)
 * AC-5: Keyboard accessible (role="radio", Tab/Enter/Space/Arrow navigation)
 * AC-7: Dark theme design system with WCAG AA compliant colors
 *
 * Story 10.3: AC-4 — deprecated badge with tooltip for deprecated strategies
 */

import { forwardRef } from "react";
import "./HookStrategyCard.css";

const DEPRECATED_TOOLTIP = "This strategy is being phased out. Consider trying newer alternatives.";

export interface HookStrategyCardProps {
  id: number;
  name: string;
  description: string;
  firstExample: string;
  bestFor: string;
  isSelected: boolean;
  onSelect: (id: number) => void;
  /** AC-5: Arrow key handler passed from parent radiogroup */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Story 10.3: AC-4 — strategy status ('active', 'deprecated', or 'retired') */
  status?: string;
  /** Story 10.5: AC-5 — show "New" badge for recently added strategies */
  isNew?: boolean;
}

const HookStrategyCard = forwardRef<HTMLDivElement, HookStrategyCardProps>(
  function HookStrategyCard(
    {
      id,
      name,
      description,
      firstExample,
      bestFor,
      isSelected,
      onSelect,
      onKeyDown: parentKeyDown,
      status = "active",
      isNew = false,
    },
    ref,
  ) {
    const isDeprecated = status === "deprecated";

    // AC-3, AC-5: Click and keyboard handlers
    const handleClick = () => {
      onSelect(id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // AC-5: Enter or Space selects the strategy
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(id);
        return;
      }
      // AC-5: Arrow keys handled by parent for navigation between cards
      if (parentKeyDown) {
        parentKeyDown(e);
      }
    };

    return (
      <div
        ref={ref}
        className={`hook-card ${isSelected ? "hook-card--selected" : ""} ${isDeprecated ? "hook-card--deprecated" : ""}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="radio"
        aria-checked={isSelected}
        aria-label={`Hook strategy: ${name}${isDeprecated ? " (Deprecated)" : ""}. ${description}. ${isSelected ? "Selected" : "Not selected"}.`}
        tabIndex={0}
        data-testid={`hook-card-${id}`}
        style={{ position: "relative" }}
      >
        {/* Story 10.5: AC-5 — "New" badge for recently added strategies */}
        {isNew && (
          <span className="new-badge" aria-label="New strategy">NEW</span>
        )}
        {/* AC-1: Strategy name, checkmark icon, and deprecated badge (Story 10.3: AC-4) */}
        <div className="hook-card__header">
          <h3 className="hook-card__name">
            {name}
            {isDeprecated && (
              <span
                className="hook-card__deprecated-badge"
                title={DEPRECATED_TOOLTIP}
                data-testid={`hook-card-deprecated-badge-${id}`}
                style={{ color: "var(--color-warning, #f59e0b)" }}
              >
                {" "}(Deprecated)
              </span>
            )}
          </h3>
          {isSelected && (
            <span className="hook-card__checkmark" aria-hidden="true">
              ✓
            </span>
          )}
        </div>

        {/* AC-1: Description (2-3 lines) */}
        <p className="hook-card__description">{description}</p>

        {/* AC-1: ONE example opening line */}
        <p className="hook-card__example">
          <em>Example:</em> "{firstExample}"
        </p>

        {/* AC-1: "Best for" tag at bottom */}
        <div className="hook-card__best-for">
          <span className="hook-card__tag">Best for: {bestFor}</span>
        </div>
      </div>
    );
  },
);

export default HookStrategyCard;
