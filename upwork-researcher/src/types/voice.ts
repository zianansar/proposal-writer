// Story 6.2: Voice profile types and constants
// Shared across VoiceSettings component and related modules

/** Default user ID for MVP (single user) */
export const DEFAULT_USER_ID = "default";

/** Debounce timeout for voice parameter saves (ms) */
export const VOICE_SAVE_DEBOUNCE_MS = 300;

/** Default voice parameter values */
export const DEFAULT_VOICE_PARAMS = {
  tone_score: 5,
  length_preference: 5,
  technical_depth: 5,
} as const;

/**
 * Full voice profile from database
 * Matches Rust VoiceProfile struct
 */
export interface VoiceProfile {
  user_id: string;
  tone_score: number;
  avg_sentence_length: number;
  vocabulary_complexity: number;
  structure_paragraphs_pct: number;
  structure_bullets_pct: number;
  technical_depth: number;
  length_preference: number;
  common_phrases: string[];
  sample_count: number;
  calibration_source: "GoldenSet" | "QuickCalibration" | "Implicit";
  created_at?: string;
  updated_at?: string;
}

/**
 * Partial update for manual voice parameter adjustments
 * Used by update_voice_parameters Tauri command
 */
export interface VoiceParameterUpdate {
  tone_score?: number;
  length_preference?: number;
  technical_depth?: number;
}

/** Value labels for tone slider (1-10 mapped to 5 labels) */
export const TONE_LABELS = [
  "Formal",
  "Professional",
  "Balanced",
  "Conversational",
  "Casual",
] as const;

/** Value labels for length slider (1-10 mapped to 5 labels) */
export const LENGTH_LABELS = [
  "Very Brief",
  "Concise",
  "Balanced",
  "Detailed",
  "Comprehensive",
] as const;

/** Value labels for technical depth slider (1-10 mapped to 5 labels) */
export const DEPTH_LABELS = [
  "Layman",
  "Basic",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

/**
 * Map 1-10 slider value to label array index (0-4)
 * 1-2 → 0, 3-4 → 1, 5-6 → 2, 7-8 → 3, 9-10 → 4
 */
export function getVoiceLabel(value: number, labels: readonly string[]): string {
  const index = Math.min(Math.floor((value - 1) / 2), labels.length - 1);
  return labels[index];
}
