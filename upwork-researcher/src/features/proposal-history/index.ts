// Proposal History feature exports (Story 8.7 + Story 7.2 + Story 7.3 + Story 7.4 + Story 7.5)
// Memory-optimized virtualized list with search, filters, detail view, and analytics dashboard

export { ProposalHistoryList } from "./ProposalHistoryList";
export { ProposalHistoryCard } from "./ProposalHistoryCard";
export { ProposalDetailView } from "./ProposalDetailView";
export { ProposalAnalyticsDashboard } from "./ProposalAnalyticsDashboard";
export { SearchFilterBar } from "./SearchFilterBar";
export { OutcomeDropdown, formatLabel } from "./OutcomeDropdown";
export { DatabaseExportButton } from "./DatabaseExportButton";
export { useProposalHistory } from "./useProposalHistory";
export { useProposalDetail } from "./useProposalDetail";
export {
  useSearchProposals,
  hasActiveFilters,
  activeFilterCount,
  DEFAULT_FILTERS,
} from "./useSearchProposals";
export { useHookStrategies } from "./useHookStrategies";
export { useUpdateProposalOutcome, OUTCOME_STATUSES } from "./useUpdateProposalOutcome";
export type { OutcomeStatus } from "./useUpdateProposalOutcome";
export type { ProposalFilters } from "./useSearchProposals";
export type {
  ProposalListItem,
  ProposalHistoryResponse,
  ProposalDetail,
  AnalyticsSummary,
  OutcomeCount,
  StrategyPerformance,
  WeeklyActivity,
} from "./types";
