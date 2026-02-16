// src/types/revisions.ts
// TypeScript types for proposal revision history (Story 6.3)

export interface RevisionSummary {
  id: number;
  proposalId: number;
  revisionType: "generation" | "edit" | "restore";
  restoredFromId: number | null;
  createdAt: string; // ISO timestamp
  contentPreview: string; // First 50 chars
}

export interface ProposalRevision {
  id: number;
  proposalId: number;
  content: string;
  revisionType: "generation" | "edit" | "restore";
  restoredFromId: number | null;
  createdAt: string;
}

// Story 6-7: Archive Old Revisions
export interface ArchivedRevision {
  id: number;
  proposalId: number; // M3 fix: Include for data integrity validation
  content: string;
  revisionType: "generation" | "edit" | "restore";
  restoredFromId: number | null;
  createdAt: string; // ISO timestamp
}
