import { forwardRef } from "react";

interface ProposalSummary {
  id: number;
  jobContent: string;
  createdAt: string;
}

interface HistoryItemProps {
  proposal: ProposalSummary;
  tabIndex?: number;
  role?: string;
  "aria-selected"?: boolean;
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Format ISO date string to a human-readable format.
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return isoString;
  }
}

const HistoryItem = forwardRef<HTMLDivElement, HistoryItemProps>(
  ({ proposal, tabIndex, role, "aria-selected": ariaSelected }, ref) => {
    const jobExcerpt = truncate(proposal.jobContent, 100);
    const formattedDate = formatDate(proposal.createdAt);

    return (
      <div
        ref={ref}
        className="history-item"
        tabIndex={tabIndex}
        role={role}
        aria-selected={ariaSelected}
      >
        <div className="history-item__job">{jobExcerpt}</div>
        <div className="history-item__date">{formattedDate}</div>
      </div>
    );
  },
);

HistoryItem.displayName = "HistoryItem";

export default HistoryItem;
export type { ProposalSummary };
