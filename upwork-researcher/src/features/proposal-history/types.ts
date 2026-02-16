// TypeScript types for Proposal History feature (Story 8.7)
import type { OutcomeStatus } from "./useUpdateProposalOutcome";

export interface ProposalListItem {
  id: number;
  jobExcerpt: string; // First 100 chars of job content
  previewText: string; // First 200 chars of generated_text
  createdAt: string; // ISO timestamp
  outcomeStatus: OutcomeStatus; // Story 7.1: pending/submitted/hired/etc.
  hookStrategyId: string | null; // Story 7.1: Hook strategy name or null
}

export interface ProposalHistoryResponse {
  proposals: ProposalListItem[];
  totalCount: number;
  hasMore: boolean;
}

// Story 7.4: Full proposal detail for detail view
export interface ProposalDetail {
  id: number;
  jobContent: string;
  generatedText: string;
  createdAt: string;
  updatedAt: string | null;
  status: string;
  outcomeStatus: OutcomeStatus;
  outcomeUpdatedAt: string | null;
  hookStrategyId: string | null;
  jobPostId: number | null;
  jobTitle: string | null;
  revisionCount: number;
}

// =========================================================================
// Story 7.5: Analytics Dashboard Types
// =========================================================================

export interface AnalyticsSummary {
  totalProposals: number;
  positiveOutcomes: number;
  resolvedProposals: number;
  proposalsThisMonth: number;
  responseRate: number; // Computed: positive / resolved * 100
  bestStrategy: string | null; // hook_strategy_id with highest rate
  bestStrategyRate: number; // response rate of best strategy
}

export interface OutcomeCount {
  outcomeStatus: string;
  count: number;
}

export interface StrategyPerformance {
  strategy: string; // hook_strategy_id or "none"
  total: number;
  positive: number;
  responseRate: number; // Computed: positive / total * 100
}

export interface WeeklyActivity {
  weekLabel: string; // e.g., "2026-W06"
  weekStart: string; // e.g., "2026-02-02"
  proposalCount: number;
  positiveCount: number;
  responseRate: number; // Computed: positive / total * 100
}
