// Story 4b.10: Hook for submitting scoring feedback

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import type { SubmitScoringFeedbackInput, ScoringFeedbackResult } from "../types";

export function useSubmitScoringFeedback() {
  const queryClient = useQueryClient();

  return useMutation<ScoringFeedbackResult, Error, SubmitScoringFeedbackInput>({
    mutationFn: async (input) => {
      return await invoke<ScoringFeedbackResult>("submit_scoring_feedback", { input });
    },
    onSuccess: (_, variables) => {
      // Invalidate can-report query for this job after successful submission
      queryClient.invalidateQueries({
        queryKey: ["canReportScore", variables.jobPostId],
      });
    },
  });
}
