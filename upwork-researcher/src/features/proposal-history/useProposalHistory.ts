// React Hook with Infinite Query for Proposal History (Story 8.7)
import { useInfiniteQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { ProposalHistoryResponse } from './types';

const PAGE_SIZE = 50;

/**
 * Hook for fetching paginated proposal history with infinite scroll support
 *
 * Uses TanStack Query's useInfiniteQuery for automatic pagination management
 *
 * @returns Query result with data, loading states, and fetchNextPage function
 *
 * @example
 * ```tsx
 * const { data, isLoading, fetchNextPage, hasNextPage } = useProposalHistory();
 *
 * // Flatten all pages
 * const allProposals = data?.pages.flatMap(page => page.proposals) ?? [];
 * ```
 */
export function useProposalHistory() {
  return useInfiniteQuery({
    queryKey: ['proposalHistory'],
    queryFn: async ({ pageParam = 0 }) => {
      return invoke<ProposalHistoryResponse>('get_proposal_history', {
        limit: PAGE_SIZE,
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // AC-5: Stop fetching when has_more === false
      if (!lastPage.hasMore) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    staleTime: 30_000,           // 30 seconds (keep data fresh)
    gcTime: 30 * 60 * 1000,      // 30 minutes (architecture spec)
  });
}
