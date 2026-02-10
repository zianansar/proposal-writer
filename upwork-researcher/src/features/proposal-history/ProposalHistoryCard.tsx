// ProposalHistoryCard component for Story 8.7
// Individual proposal card in virtualized list
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { ProposalListItem } from './types';
import './ProposalHistoryCard.css';

interface ProposalHistoryCardProps {
  proposal: ProposalListItem;
  style: React.CSSProperties;
}

/**
 * Individual proposal card for virtualized history list
 * Fixed height: 72px (matches virtualization config)
 *
 * @param proposal - Lightweight proposal data (no full content)
 * @param style - Positioning style from react-window
 */
export function ProposalHistoryCard({ proposal, style }: ProposalHistoryCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // AC-6: Full content loads only when user clicks
    navigate(`/proposal/${proposal.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

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
        <div className="proposal-job-excerpt">
          {proposal.jobExcerpt || 'Untitled Job'}
        </div>
        <div className="proposal-preview">
          {proposal.previewText || 'No preview available'}
        </div>
        <div className="proposal-date">
          {formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
