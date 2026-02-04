interface ProposalSummary {
  id: number;
  jobContent: string;
  createdAt: string;
}

interface HistoryItemProps {
  proposal: ProposalSummary;
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

function HistoryItem({ proposal }: HistoryItemProps) {
  const jobExcerpt = truncate(proposal.jobContent, 100);
  const formattedDate = formatDate(proposal.createdAt);

  return (
    <div className="history-item">
      <div className="history-item__job">{jobExcerpt}</div>
      <div className="history-item__date">{formattedDate}</div>
    </div>
  );
}

export default HistoryItem;
export type { ProposalSummary };
