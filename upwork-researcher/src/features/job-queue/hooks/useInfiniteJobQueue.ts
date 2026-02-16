/**
 * Infinite scroll job queue hook - Story 4b.9 Task 11
 * Uses TanStack Query's useInfiniteQuery for pagination
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import type { JobQueueResponse, SortField, ScoreFilter } from "../types";

interface UseInfiniteJobQueueParams {
  sortBy: SortField;
  filter: ScoreFilter;
  limit?: number;
}

/**
 * Infinite scroll job queue hook
 * AC-9: Automatically loads next page when user scrolls near bottom
 */
export function useInfiniteJobQueue({ sortBy, filter, limit = 50 }: UseInfiniteJobQueueParams) {
  return useInfiniteQuery({
    queryKey: ["jobQueue", "infinite", sortBy, filter],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await invoke<JobQueueResponse>("get_job_queue", {
        sortBy,
        filter,
        limit,
        offset: pageParam,
      });
      return response;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      // Calculate next offset based on total jobs loaded so far
      const totalLoaded = allPages.reduce((sum, page) => sum + page.jobs.length, 0);
      return totalLoaded;
    },
    staleTime: 30_000, // 30 seconds
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
