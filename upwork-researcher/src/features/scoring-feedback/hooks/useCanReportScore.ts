// Story 4b.10: Hook for checking if user can report a score

import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { CanReportResult } from "../types";

export function useCanReportScore(jobPostId: number) {
  return useQuery<CanReportResult, Error>({
    queryKey: ["canReportScore", jobPostId],
    queryFn: async () => {
      return await invoke<CanReportResult>("check_can_report_score", { jobPostId });
    },
    // Check this relatively frequently in case user has the modal open
    staleTime: 1000 * 60, // 1 minute
    refetchOnMount: true,
  });
}
