// Voice Learning feature types

export interface VoiceProfile {
  tone_score: number; // 1-10: formal to casual
  avg_sentence_length: number; // Average words per sentence
  vocabulary_complexity: number; // Flesch-Kincaid grade level
  structure_preference: {
    paragraphs_pct: number; // 0-100
    bullets_pct: number; // 0-100
  };
  technical_depth: number; // 1-10: layman to expert
  common_phrases: string[]; // Top 5 repeated phrases
  sample_count: number; // Number of proposals analyzed
  calibration_source: "GoldenSet" | "QuickCalibration" | "Implicit";
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

/** Quick calibration answers sent to backend (TD-5 AC-2: single source of truth) */
export interface QuickCalibrationAnswers {
  tone: "formal" | "professional" | "conversational" | "casual";
  length: "brief" | "moderate" | "detailed";
  technicalDepth: "simple" | "technical" | "expert";
  structure: "bullets" | "paragraphs" | "mixed";
  callToAction: "direct" | "consultative" | "question";
}

/** Progress event payload from Tauri backend (Story 5.4: AC-4) */
export interface AnalysisProgress {
  current: number; // Current proposal being analyzed (1-based)
  total: number; // Total proposals to analyze
}

/** Result of voice calibration (Story 5.4: AC-5, AC-6) */
export interface CalibrationResult {
  profile: VoiceProfile;
  elapsed_ms: number;
  proposals_analyzed: number;
}

export interface MappedMetric {
  label: string; // Human-readable label
  description: string; // Quantified explanation
  emoji: string; // Visual icon
}

/** Voice learning progress tracking (Story 8.6) */
export interface VoiceLearningProgress {
  proposalsEditedCount: number;
  status: "initial" | "learning" | "refining" | "personalized";
  progressPercent: number; // 0-100
}

/** Calculate voice learning status based on proposal count */
export function getVoiceLearningStatus(count: number): VoiceLearningProgress {
  if (count === 0) {
    return { proposalsEditedCount: count, status: "initial", progressPercent: 0 };
  } else if (count < 5) {
    return { proposalsEditedCount: count, status: "learning", progressPercent: (count / 10) * 100 };
  } else if (count < 10) {
    return { proposalsEditedCount: count, status: "refining", progressPercent: (count / 10) * 100 };
  } else {
    return { proposalsEditedCount: count, status: "personalized", progressPercent: 100 };
  }
}
