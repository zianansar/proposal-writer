/**
 * Pipeline Stage Types
 *
 * Defines the types and constants for the generation pipeline stage indicators.
 * This enables real-time progress feedback during proposal generation.
 */

export type StageStatus = "pending" | "active" | "complete" | "error";

export interface PipelineStage {
  id: string;
  label: string;
  status: StageStatus;
  /** Duration in milliseconds (only set when complete) */
  durationMs?: number;
  /** Error message (only set when status is 'error') */
  error?: string;
}

/**
 * MVP Pipeline Stages
 *
 * Future Epic 5 stages will be inserted between 'preparing' and 'generating':
 * - 'analyzing': "Analyzing job..." (job entity extraction)
 * - 'hook': "Selecting hook approach..." (hook strategy matching)
 * - 'voice': "Loading your voice profile..." (voice parameters)
 */
export const PIPELINE_STAGES = [
  { id: "preparing", label: "Preparing..." },
  { id: "generating", label: "Generating proposal..." },
  { id: "complete", label: "Complete!" },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]["id"];
