// Hook for fetching full proposal detail (Story 7.4 AC-1)
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { ProposalDetail } from './types';

/**
 * Fetch a single proposal's full detail by ID.
 * Uses queryKey ['proposal', id] — separate from the list cache.
 * Disabled when id is null/undefined (no fetch until card is clicked).
 */
export function useProposalDetail(id: number | null | undefined) {
  return useQuery<ProposalDetail>({
    queryKey: ['proposal', id],
    queryFn: () => invoke<ProposalDetail>('get_proposal_detail', { id }),
    enabled: !!id,
  });
}
