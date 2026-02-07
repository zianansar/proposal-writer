/** Flagged sentence from perplexity analysis (Story 3.2) */
export interface FlaggedSentence {
  text: string;
  suggestion: string;
  index: number;
}

/** Perplexity analysis result from Rust backend (Story 3.1 + 3.2) */
export interface PerplexityAnalysis {
  score: number;
  threshold: number;
  flaggedSentences: FlaggedSentence[];
}

/**
 * Default perplexity threshold for AI detection (FR-11)
 * Scores >= this value trigger safety warning modal
 * Story 3.5 makes this configurable (140-220 range)
 */
export const DEFAULT_PERPLEXITY_THRESHOLD = 180;
