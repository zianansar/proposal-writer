// TanStack Query hooks for analytics dashboard (Story 7.5)
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import type { AnalyticsSummary, OutcomeCount, StrategyPerformance, WeeklyActivity } from "./types";

/**
 * Fetches analytics summary metrics (Story 7.5 AC-1).
 * Includes total proposals, response rate, best strategy, and monthly count.
 */
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => invoke<AnalyticsSummary>("get_proposal_analytics_summary"),
    staleTime: 5 * 60 * 1000, // 5 minutes - analytics don't change frequently
  });
}

/**
 * Fetches outcome distribution for bar chart (Story 7.5 AC-2).
 * Returns count of proposals per outcome status.
 */
export function useOutcomeDistribution() {
  return useQuery({
    queryKey: ["analytics", "outcomes"],
    queryFn: () => invoke<OutcomeCount[]>("get_outcome_distribution"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetches response rate by hook strategy (Story 7.5 AC-3).
 * Returns performance metrics per strategy, sorted by response rate descending.
 */
export function useStrategyPerformance() {
  return useQuery({
    queryKey: ["analytics", "strategies"],
    queryFn: () => invoke<StrategyPerformance[]>("get_response_rate_by_strategy"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetches weekly proposal activity (Story 7.5 AC-4).
 * Returns proposal count and response rate per week for the last N weeks.
 *
 * @param weeks - Number of weeks to look back (default: 12)
 */
export function useWeeklyActivity(weeks?: number) {
  return useQuery({
    queryKey: ["analytics", "weekly", weeks ?? 12],
    queryFn: () => invoke<WeeklyActivity[]>("get_weekly_activity", { weeks: weeks ?? 12 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
