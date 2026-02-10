// Unit tests for Quick Calibration mapper (Story 5.7)

import { describe, it, expect } from 'vitest';
import { mapAnswersToProfile, type QuickCalibrationAnswers } from './quickCalibrationMapper';

describe('quickCalibrationMapper', () => {
  describe('mapAnswersToProfile', () => {
    describe('tone mapping', () => {
      it('maps formal to tone_score 9', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'formal',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.tone_score).toBe(9);
      });

      it('maps professional to tone_score 7', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.tone_score).toBe(7);
      });

      it('maps conversational to tone_score 5', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'conversational',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.tone_score).toBe(5);
      });

      it('maps casual to tone_score 3', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'casual',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.tone_score).toBe(3);
      });
    });

    describe('length mapping', () => {
      it('maps brief to avg_sentence_length 10', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'brief',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.avg_sentence_length).toBe(10);
      });

      it('maps moderate to avg_sentence_length 16', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.avg_sentence_length).toBe(16);
      });

      it('maps detailed to avg_sentence_length 24', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'detailed',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.avg_sentence_length).toBe(24);
      });
    });

    describe('technical depth mapping', () => {
      it('maps simple to technical_depth 3', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'simple',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.technical_depth).toBe(3);
      });

      it('maps technical to technical_depth 6', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.technical_depth).toBe(6);
      });

      it('maps expert to technical_depth 9', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'expert',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.technical_depth).toBe(9);
      });
    });

    describe('structure mapping', () => {
      it('maps bullets to 80/20 split (favor bullets)', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'bullets',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.structure_preference.bullets_pct).toBe(80);
        expect(profile.structure_preference.paragraphs_pct).toBe(20);
      });

      it('maps paragraphs to 20/80 split (favor paragraphs)', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'paragraphs',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.structure_preference.bullets_pct).toBe(20);
        expect(profile.structure_preference.paragraphs_pct).toBe(80);
      });

      it('maps mixed to 50/50 split', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.structure_preference.bullets_pct).toBe(50);
        expect(profile.structure_preference.paragraphs_pct).toBe(50);
      });
    });

    describe('default values and metadata', () => {
      it('sets calibration_source to QuickCalibration', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.calibration_source).toBe('QuickCalibration');
      });

      it('sets sample_count to 0 (no proposals analyzed)', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.sample_count).toBe(0);
      });

      it('sets common_phrases to empty array', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.common_phrases).toEqual([]);
      });

      it('sets vocabulary_complexity to default 8.0 (professional average)', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'professional',
          length: 'moderate',
          technicalDepth: 'technical',
          structure: 'mixed',
          callToAction: 'direct',
        };
        const profile = mapAnswersToProfile(answers);
        expect(profile.vocabulary_complexity).toBe(8.0);
      });
    });

    describe('complete profile generation', () => {
      it('generates complete profile with all fields from answers', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'conversational',
          length: 'brief',
          technicalDepth: 'simple',
          structure: 'bullets',
          callToAction: 'question',
        };
        const profile = mapAnswersToProfile(answers);

        expect(profile).toMatchObject({
          tone_score: 5,
          avg_sentence_length: 10,
          vocabulary_complexity: 8.0,
          structure_preference: { bullets_pct: 80, paragraphs_pct: 20 },
          technical_depth: 3,
          common_phrases: [],
          sample_count: 0,
          calibration_source: 'QuickCalibration',
        });
      });

      it('generates profile for maximum formality (all high values)', () => {
        const answers: QuickCalibrationAnswers = {
          tone: 'formal',
          length: 'detailed',
          technicalDepth: 'expert',
          structure: 'paragraphs',
          callToAction: 'consultative',
        };
        const profile = mapAnswersToProfile(answers);

        expect(profile).toMatchObject({
          tone_score: 9,
          avg_sentence_length: 24,
          technical_depth: 9,
          structure_preference: { bullets_pct: 20, paragraphs_pct: 80 },
        });
      });
    });
  });
});
