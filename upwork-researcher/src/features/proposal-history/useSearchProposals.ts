// Hook for searching/filtering proposal history (Story 7.3)
import { useInfiniteQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import type { ProposalHistoryResponse } from "./types";

const PAGE_SIZE = 50;

export interface ProposalFilters {
  searchText: string; // '' = no filter
  outcomeStatus: string; // '' = all statuses
  dateRangeDays: number; // 0 = all time, 7/30/90
  hookStrategy: string; // '' = all strategies
}

const DEFAULT_FILTERS: ProposalFilters = {
  searchText: "",
  outcomeStatus: "",
  dateRangeDays: 0,
  hookStrategy: "",
};

/** Check if any filter is active (non-default) */
export function hasActiveFilters(filters: ProposalFilters): boolean {
  return (
    filters.searchText !== "" ||
    filters.outcomeStatus !== "" ||
    filters.dateRangeDays !== 0 ||
    filters.hookStrategy !== ""
  );
}

/** Count how many filters are active */
export function activeFilterCount(filters: ProposalFilters): number {
  let count = 0;
  if (filters.searchText !== "") count++;
  if (filters.outcomeStatus !== "") count++;
  if (filters.dateRangeDays !== 0) count++;
  if (filters.hookStrategy !== "") count++;
  return count;
}

export { DEFAULT_FILTERS };

/**
 * Hook for searching/filtering proposal history with infinite scroll (Story 7.3).
 *
 * When all filters are empty/default, uses the same queryKey as useProposalHistory
 * so they share the TanStack Query cache. When filters are active, a parameterized
 * queryKey separates the cache per filter combination.
 */
export function useSearchProposals(filters: ProposalFilters = DEFAULT_FILTERS) {
  const isFiltered = hasActiveFilters(filters);

  return useInfiniteQuery({
    // When no filters, use same key as useProposalHistory for cache sharing
    queryKey: isFiltered
      ? [
          "proposalHistory",
          {
            searchText: filters.searchText,
            outcomeStatus: filters.outcomeStatus,
            dateRangeDays: filters.dateRangeDays,
            hookStrategy: filters.hookStrategy,
          },
        ]
      : ["proposalHistory"],
    queryFn: async ({ pageParam = 0 }) => {
      if (isFiltered) {
        return invoke<ProposalHistoryResponse>("search_proposals", {
          searchText: filters.searchText || null,
          outcomeStatus: filters.outcomeStatus || null,
          dateRangeDays: filters.dateRangeDays || null,
          hookStrategy: filters.hookStrategy || null,
          limit: PAGE_SIZE,
          offset: pageParam,
        });
      }
      // No filters — use same endpoint as useProposalHistory
      return invoke<ProposalHistoryResponse>("get_proposal_history", {
        limit: PAGE_SIZE,
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    staleTime: 30_000,
    gcTime: 30 * 60 * 1000,
  });
}
