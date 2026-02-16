import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import type { ProposalHistoryResponse } from "./types";

/** Valid outcome status values matching Rust VALID_OUTCOME_STATUSES */
export const OUTCOME_STATUSES = [
  "pending",
  "submitted",
  "response_received",
  "interview",
  "hired",
  "no_response",
  "rejected",
] as const;

export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

interface UpdateOutcomeParams {
  proposalId: number;
  outcomeStatus: OutcomeStatus;
}

interface InfiniteQueryData {
  pages: ProposalHistoryResponse[];
  pageParams: unknown[];
}

interface MutationContext {
  previousData: InfiniteQueryData | undefined;
}

/**
 * Mutation hook for updating proposal outcome status (Story 7.2, AC-2, AC-5).
 *
 * Uses TanStack useMutation with optimistic updates on the proposalHistory cache.
 * On error, rolls back to previous status. Returns toast state for UI notification.
 */
export function useUpdateProposalOutcome() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, UpdateOutcomeParams, MutationContext>({
    mutationFn: async ({ proposalId, outcomeStatus }: UpdateOutcomeParams) => {
      return invoke("update_proposal_outcome", {
        proposalId,
        outcomeStatus,
      });
    },

    // AC-2: Optimistic update — badge updates immediately
    onMutate: async ({ proposalId, outcomeStatus }) => {
      // Cancel in-flight refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ["proposalHistory"] });

      // Snapshot entire query data for rollback (preserves pages + pageParams)
      const previousData = queryClient.getQueryData<InfiniteQueryData>(["proposalHistory"]);

      // Optimistically update the proposal in cache
      queryClient.setQueryData<InfiniteQueryData>(["proposalHistory"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            proposals: page.proposals.map((p) =>
              p.id === proposalId ? { ...p, outcomeStatus } : p,
            ),
          })),
        };
      });

      return { previousData };
    },

    // AC-5: Rollback on error — restore entire snapshot
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["proposalHistory"], context.previousData);
      }
    },

    // Invalidate to ensure server state sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["proposalHistory"] });
      // CR R2 H-2: Invalidate analytics cache so dashboard reflects outcome changes
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
