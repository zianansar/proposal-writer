/**
 * Job Queue data fetching hook - Story 4b.9
 * Uses TanStack Query for caching and automatic refetching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { JobQueueResponse, SortField, ScoreFilter } from '../types';

/**
 * Fetch job queue from backend
 * AC-3: Supports sorting by score (default), date, client name
 * AC-5: Supports filtering by color (all, green only, yellow+green)
 * AC-7: Query completes in <500ms (backend responsibility)
 */
export function useJobQueue(sortBy: SortField, filter: ScoreFilter) {
  return useQuery({
    queryKey: ['jobQueue', sortBy, filter],
    queryFn: async () => {
      const response = await invoke<JobQueueResponse>('get_job_queue', {
        sortBy,
        filter,
        limit: 50,
        offset: 0,
      });
      return response;
    },
    staleTime: 30_000, // 30 seconds - data stays fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - per architecture spec
  });
}

/**
 * Hook to invalidate job queue cache
 * Use after importing new jobs or updating scores
 */
export function useInvalidateJobQueue() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['jobQueue'] });
}
