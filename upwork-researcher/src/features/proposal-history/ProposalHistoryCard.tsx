// ProposalHistoryCard component for Story 8.7 + Story 7.2 + Story 7.4
// Individual proposal card in virtualized list
import { formatDistanceToNow } from "date-fns";
import { useRef, useState, useCallback } from "react";

import { OutcomeDropdown, formatLabel } from "./OutcomeDropdown";
import type { ProposalListItem } from "./types";
import type { OutcomeStatus } from "./useUpdateProposalOutcome";
import "./ProposalHistoryCard.css";

interface ProposalHistoryCardProps {
  proposal: ProposalListItem;
  style: React.CSSProperties;
  /** Story 7.2: Callback when user changes outcome status */
  onStatusChange?: (proposalId: number, status: OutcomeStatus) => void;
  /** Story 7.4: Callback when card is clicked to open detail view */
  onCardClick?: (proposalId: number) => void;
}

/**
 * Individual proposal card for virtualized history list
 * Fixed height: 72px (matches virtualization config)
 *
 * @param proposal - Lightweight proposal data (no full content)
 * @param style - Positioning style from react-window
 * @param onStatusChange - Story 7.2: callback for outcome status mutation
 * @param onCardClick - Story 7.4: callback for navigating to detail view
 */
export function ProposalHistoryCard({
  proposal,
  style,
  onStatusChange,
  onCardClick,
}: ProposalHistoryCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    // Story 7.4: Use callback prop instead of router navigation
    onCardClick?.(proposal.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Story 7.2 AC-3: Badge click opens dropdown, stops card navigation
  const handleBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDropdownOpen((prev) => !prev);
  }, []);

  // Story 7.2 AC-3: Badge keydown stops card navigation
  const handleBadgeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.stopPropagation();
      e.preventDefault();
      setDropdownOpen((prev) => !prev);
    }
  }, []);

  const handleSelect = useCallback(
    (status: OutcomeStatus) => {
      setDropdownOpen(false);
      if (status !== proposal.outcomeStatus) {
        onStatusChange?.(proposal.id, status);
      }
      // AC-4: Return focus to badge
      badgeRef.current?.focus();
    },
    [onStatusChange, proposal.id, proposal.outcomeStatus],
  );

  const handleDropdownClose = useCallback(() => {
    setDropdownOpen(false);
    // AC-4: Return focus to badge
    badgeRef.current?.focus();
  }, []);

  return (
    <div
      style={style}
      className="proposal-history-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View proposal for ${proposal.jobExcerpt}`}
    >
      <div className="proposal-card-content">
        <div className="proposal-card-header">
          <div className="proposal-job-excerpt">{proposal.jobExcerpt || "Untitled Job"}</div>
          {/* Story 7.2 AC-1: Clickable outcome badge with dropdown */}
          <button
            ref={badgeRef}
            type="button"
            className={`proposal-outcome-badge proposal-outcome-badge--${proposal.outcomeStatus}`}
            aria-label={`Outcome: ${formatLabel(proposal.outcomeStatus)}`}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            onClick={handleBadgeClick}
            onKeyDown={handleBadgeKeyDown}
          >
            {formatLabel(proposal.outcomeStatus)}
          </button>
          {dropdownOpen && badgeRef.current && (
            <OutcomeDropdown
              currentStatus={proposal.outcomeStatus}
              onSelect={handleSelect}
              onClose={handleDropdownClose}
              anchorRect={badgeRef.current.getBoundingClientRect()}
            />
          )}
        </div>
        <div className="proposal-preview">{proposal.previewText || "No preview available"}</div>
        <div className="proposal-date">
          {formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
