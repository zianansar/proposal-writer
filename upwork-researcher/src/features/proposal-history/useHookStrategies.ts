// Hook for fetching distinct hook strategies (Story 7.3)
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

/**
 * Fetches distinct hook strategy IDs from the proposals table.
 * Used to populate the hook strategy filter dropdown.
 */
export function useHookStrategies() {
  return useQuery({
    queryKey: ["hookStrategies"],
    queryFn: () => invoke<string[]>("get_distinct_hook_strategies"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
