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
