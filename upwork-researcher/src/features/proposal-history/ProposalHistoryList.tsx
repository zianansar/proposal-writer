// ProposalHistoryList component for Story 8.7 + Story 7.2 + Story 7.3
// Virtualized list with infinite scroll, search, and filters
import { useEffect, useState, useCallback } from 'react';
import { VirtualizedList, VirtualizedListSkeleton, useInfiniteScroll } from '../../lib/virtualization';
import { ProposalHistoryCard } from './ProposalHistoryCard';
import { SearchFilterBar } from './SearchFilterBar';
import { DatabaseExportButton } from './DatabaseExportButton'; // Story 7.6
import { useSearchProposals, DEFAULT_FILTERS, hasActiveFilters } from './useSearchProposals';
import { useHookStrategies } from './useHookStrategies';
import { useUpdateProposalOutcome } from './useUpdateProposalOutcome';
import type { ProposalFilters } from './useSearchProposals';
import type { ProposalListItem } from './types';
import type { OutcomeStatus } from './useUpdateProposalOutcome';
import './ProposalHistoryList.css';

// Layout constants
const SIDEBAR_WIDTH = 240;
const HEADER_HEIGHT = 200;
const FILTER_BAR_HEIGHT = 100; // Approximate height of SearchFilterBar
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const ROW_HEIGHT = 72; // AC-1: Fixed row height for virtualization
const TOAST_SUCCESS_MS = 3000;
const TOAST_ERROR_MS = 5000;

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

/**
 * Virtualized proposal history list with infinite scroll, search, and filters
 *
 * Story 8.7: Virtualization, infinite scroll, memory optimization
 * Story 7.2: Outcome status badges with dropdown
 * Story 7.3: Search input + outcome/date/strategy filters
 */
interface ProposalHistoryListProps {
  /** Story 7.4: Callback when user clicks a card to view detail */
  onProposalSelect?: (proposalId: number) => void;
}

export function ProposalHistoryList({ onProposalSelect }: ProposalHistoryListProps = {}) {
  // Window dimensions for responsive sizing
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth - SIDEBAR_WIDTH : DEFAULT_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT - FILTER_BAR_HEIGHT : DEFAULT_HEIGHT,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - SIDEBAR_WIDTH,
        height: window.innerHeight - HEADER_HEIGHT - FILTER_BAR_HEIGHT,
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Story 7.3: Filter state
  const [filters, setFilters] = useState<ProposalFilters>(DEFAULT_FILTERS);

  // Story 7.3: Search/filter query (backward compatible — empty filters = same as useProposalHistory)
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useSearchProposals(filters);

  // Story 7.3: Fetch distinct hook strategies for filter dropdown
  const { data: hookStrategies } = useHookStrategies();

  // Story 7.2 AC-2: Outcome status mutation with toast
  const { mutate: updateOutcomeMutate } = useUpdateProposalOutcome();
  const [toast, setToast] = useState<ToastState | null>(null);

  // Story 7.2 AC-2/AC-5: Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const ms = toast.type === 'success' ? TOAST_SUCCESS_MS : TOAST_ERROR_MS;
    const timeoutId = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  // Story 7.2 AC-2: Handle status change from card badge
  const handleStatusChange = useCallback(
    (proposalId: number, outcomeStatus: OutcomeStatus) => {
      updateOutcomeMutate(
        { proposalId, outcomeStatus },
        {
          onSuccess: () => {
            const label = outcomeStatus.replace(/_/g, ' ');
            setToast({ type: 'success', message: `Outcome updated to '${label}'` });
          },
          onError: (error) => {
            setToast({ type: 'error', message: error.message || 'Failed to update outcome' });
          },
        }
      );
    },
    [updateOutcomeMutate]
  );

  // Story 7.3: Handle filter changes (CR R2 L-1: setFilters is already stable)
  const handleFilterChange = setFilters;

  // Flatten all pages into single array
  const allProposals: ProposalListItem[] = data?.pages.flatMap(page => page.proposals) ?? [];

  // Total count from first page
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // AC-5: Infinite scroll hook - triggers when user scrolls near bottom
  const { onItemsRendered } = useInfiniteScroll({
    hasMore: hasNextPage ?? false,
    isFetching: isFetchingNextPage,
    fetchNextPage,
    threshold: 10,
  });

  // Show loading skeleton during initial load
  if (isLoading) {
    return <VirtualizedListSkeleton rowCount={10} rowHeight={ROW_HEIGHT} />;
  }

  const isFiltered = hasActiveFilters(filters);

  // Story 7.3 AC-6: Empty state for filtered results
  if (allProposals.length === 0 && isFiltered) {
    return (
      <div className="proposal-history-list">
        <SearchFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          hookStrategies={hookStrategies ?? []}
          resultCount={0}
        />
        <div className="empty-state empty-state--filtered">
          <p>No proposals match your filters</p>
        </div>
      </div>
    );
  }

  // Empty state (no proposals at all)
  if (allProposals.length === 0) {
    return (
      <div className="empty-state">
        <p>No proposals yet. Create your first proposal to get started!</p>
      </div>
    );
  }

  return (
    <div className="proposal-history-list">
      {/* Story 7.3: Search and filter bar */}
      <SearchFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        hookStrategies={hookStrategies ?? []}
        resultCount={totalCount}
      />

      {/* Story 7.6: Database export button */}
      <div className="history-toolbar">
        <DatabaseExportButton />
      </div>

      {/* AC-1: Virtualized list with fixed row height */}
      <VirtualizedList
        items={allProposals}
        rowHeight={ROW_HEIGHT}
        width={dimensions.width}
        height={dimensions.height}
        renderRow={(proposal, _index, style) => (
          <ProposalHistoryCard
            proposal={proposal}
            style={style}
            onStatusChange={handleStatusChange}
            onCardClick={onProposalSelect}
          />
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

      {/* Story 7.2 AC-2/AC-5: Toast notification for outcome updates */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`outcome-toast outcome-toast--${toast.type}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
