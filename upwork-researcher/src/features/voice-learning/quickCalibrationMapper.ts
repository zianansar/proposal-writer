// Quick Calibration answer-to-profile mapping for Story 5.7

import type { VoiceProfile } from './types';

export interface QuickCalibrationAnswers {
  tone: 'formal' | 'professional' | 'conversational' | 'casual';
  length: 'brief' | 'moderate' | 'detailed';
  technicalDepth: 'simple' | 'technical' | 'expert';
  structure: 'bullets' | 'paragraphs' | 'mixed';
  callToAction: 'direct' | 'consultative' | 'question';
}

const TONE_SCORES: Record<string, number> = {
  formal: 9,
  professional: 7,
  conversational: 5,
  casual: 3,
};

const LENGTH_TO_SENTENCE_LENGTH: Record<string, number> = {
  brief: 10,
  moderate: 16,
  detailed: 24,
};

const DEPTH_SCORES: Record<string, number> = {
  simple: 3,
  technical: 6,
  expert: 9,
};

const STRUCTURE_PREFS: Record<string, { paragraphs_pct: number; bullets_pct: number }> = {
  bullets: { paragraphs_pct: 20, bullets_pct: 80 },
  paragraphs: { paragraphs_pct: 80, bullets_pct: 20 },
  mixed: { paragraphs_pct: 50, bullets_pct: 50 },
};

export function mapAnswersToProfile(answers: QuickCalibrationAnswers): VoiceProfile {
  return {
    tone_score: TONE_SCORES[answers.tone],
    avg_sentence_length: LENGTH_TO_SENTENCE_LENGTH[answers.length],
    vocabulary_complexity: 8.0, // Default professional average
    structure_preference: STRUCTURE_PREFS[answers.structure],
    technical_depth: DEPTH_SCORES[answers.technicalDepth],
    common_phrases: [], // Empty for quick calibration
    sample_count: 0, // No actual proposals analyzed
    calibration_source: 'QuickCalibration',
  };
}
