// ProposalHistoryList component for Story 8.7
// Virtualized list with infinite scroll for 100+ proposals
import { useEffect, useState } from 'react';
import { VirtualizedList, VirtualizedListSkeleton, useInfiniteScroll } from '../../lib/virtualization';
import { ProposalHistoryCard } from './ProposalHistoryCard';
import { useProposalHistory } from './useProposalHistory';
import type { ProposalListItem } from './types';
import './ProposalHistoryList.css';

// Layout constants
const SIDEBAR_WIDTH = 240;
const HEADER_HEIGHT = 200;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const ROW_HEIGHT = 72; // AC-1: Fixed row height for virtualization

/**
 * Virtualized proposal history list with infinite scroll
 *
 * AC-1: Only renders visible rows (~15-20 DOM nodes)
 * AC-2: Smooth scrolling at 60fps (no jank)
 * AC-3: Memory usage <300MB (NFR-2)
 * AC-4: Initial load <500ms (NFR-17)
 * AC-5: Infinite scroll with automatic loading
 */
export function ProposalHistoryList() {
  // Window dimensions for responsive sizing
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth - SIDEBAR_WIDTH : DEFAULT_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT : DEFAULT_HEIGHT,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - SIDEBAR_WIDTH,
        height: window.innerHeight - HEADER_HEIGHT,
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize(); // Set initial size
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // AC-5: Fetch proposal history with infinite scroll
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProposalHistory();

  // Flatten all pages into single array
  const allProposals: ProposalListItem[] = data?.pages.flatMap(page => page.proposals) ?? [];

  // AC-5: Infinite scroll hook - triggers when user scrolls near bottom
  const { onItemsRendered } = useInfiniteScroll({
    hasMore: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    fetchNextPage,
    threshold: 10, // Trigger when within 10 items of bottom
  });

  // Show loading skeleton during initial load
  if (isLoading) {
    return <VirtualizedListSkeleton rowCount={10} rowHeight={ROW_HEIGHT} />;
  }

  // Empty state
  if (allProposals.length === 0) {
    return (
      <div className="empty-state">
        <p>No proposals yet. Create your first proposal to get started!</p>
      </div>
    );
  }

  // AC-1: Virtualized list with fixed row height
  return (
    <div className="proposal-history-list">
      <VirtualizedList
        items={allProposals}
        rowHeight={ROW_HEIGHT}
        width={dimensions.width}
        height={dimensions.height}
        renderRow={(proposal, _index, style) => (
          <ProposalHistoryCard proposal={proposal} style={style} />
        )}
        getItemKey={(proposal) => proposal.id}
        onItemsRendered={(info) => onItemsRendered(info, allProposals.length)}
      />

      {/* AC-5: Loading indicator during infinite scroll fetch */}
      {isFetchingNextPage && (
        <div className="loading-more">
          <span>Loading more proposals...</span>
        </div>
      )}
    </div>
  );
}
