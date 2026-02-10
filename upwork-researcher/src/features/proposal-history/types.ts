// TypeScript types for Proposal History feature (Story 8.7)

export interface ProposalListItem {
  id: number;
  jobExcerpt: string;      // First 100 chars of job content
  previewText: string;     // First 200 chars of generated_text
  createdAt: string;       // ISO timestamp
}

export interface ProposalHistoryResponse {
  proposals: ProposalListItem[];
  totalCount: number;
  hasMore: boolean;
}
