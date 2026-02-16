/**
 * Job Queue types for Story 4b.9
 *
 * Note: These mirror the Rust types in src-tauri/src/job/types.rs
 * Manual TypeScript definitions until tauri-specta is configured in Epic 8
 */

export type ScoreColor = "green" | "yellow" | "red" | "gray";

export type SortField = "score" | "date" | "clientName";

export type ScoreFilter = "all" | "greenOnly" | "yellowAndGreen";

export interface JobQueueItem {
  id: number;
  clientName: string;
  jobTitle: string;
  skillsMatchPercent: number | null;
  clientQualityPercent: number | null;
  overallScore: number | null;
  scoreColor: ScoreColor;
  createdAt: string | null;
}

/**
 * Color counts for filter chips (AC-5)
 * [AI-Review Fix H2]: Added to show per-filter counts in UI
 */
export interface ColorCounts {
  green: number;
  yellow: number;
  red: number;
  gray: number;
}

export interface JobQueueResponse {
  jobs: JobQueueItem[];
  totalCount: number;
  hasMore: boolean;
  /** [AI-Review Fix H2]: Color counts for filter chip labels */
  colorCounts: ColorCounts;
}
