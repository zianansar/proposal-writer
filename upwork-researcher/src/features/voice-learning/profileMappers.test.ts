import { describe, it, expect } from 'vitest';
import {
  mapToneScore,
  mapSentenceLength,
  mapStructurePreference,
  mapTechnicalDepth,
} from './profileMappers';

describe('profileMappers', () => {
  describe('mapToneScore', () => {
    it('maps score 1-3 to "Very Casual"', () => {
      expect(mapToneScore(1).label).toBe('Very Casual');
      expect(mapToneScore(2).label).toBe('Very Casual');
      expect(mapToneScore(3).label).toBe('Very Casual');
      expect(mapToneScore(1).emoji).toBe('📝');
    });

    it('maps score 4-5 to "Conversational"', () => {
      expect(mapToneScore(4).label).toBe('Conversational');
      expect(mapToneScore(5).label).toBe('Conversational');
    });

    it('maps score 6-7 to "Professional"', () => {
      expect(mapToneScore(6).label).toBe('Professional');
      expect(mapToneScore(7).label).toBe('Professional');
      expect(mapToneScore(6.5).label).toBe('Professional');
    });

    it('maps score 8-9 to "Formal"', () => {
      expect(mapToneScore(8).label).toBe('Formal');
      expect(mapToneScore(9).label).toBe('Formal');
    });

    it('maps score 10 to "Academic"', () => {
      expect(mapToneScore(10).label).toBe('Academic');
    });

    it('handles boundary values correctly', () => {
      expect(mapToneScore(3.0).label).toBe('Very Casual');
      expect(mapToneScore(3.1).label).toBe('Conversational');
      expect(mapToneScore(5.0).label).toBe('Conversational');
      expect(mapToneScore(5.1).label).toBe('Professional');
      expect(mapToneScore(7.0).label).toBe('Professional');
      expect(mapToneScore(7.1).label).toBe('Formal');
      expect(mapToneScore(9.0).label).toBe('Formal');
      expect(mapToneScore(9.1).label).toBe('Academic');
    });

    it('includes percentage in description', () => {
      const result = mapToneScore(6);
      expect(result.description).toContain('60%');
      expect(result.description).toContain('formal language');
    });
  });

  describe('mapSentenceLength', () => {
    it('maps <10 words to "Very Concise"', () => {
      expect(mapSentenceLength(5).label).toBe('Very Concise');
      expect(mapSentenceLength(9).label).toBe('Very Concise');
    });

    it('maps 10-14 words to "Concise"', () => {
      expect(mapSentenceLength(10).label).toBe('Concise');
      expect(mapSentenceLength(12).label).toBe('Concise');
      expect(mapSentenceLength(14).label).toBe('Concise');
    });

    it('maps 15-20 words to "Moderate"', () => {
      expect(mapSentenceLength(15).label).toBe('Moderate');
      expect(mapSentenceLength(18).label).toBe('Moderate');
      expect(mapSentenceLength(20).label).toBe('Moderate');
    });

    it('maps 21-25 words to "Detailed"', () => {
      expect(mapSentenceLength(21).label).toBe('Detailed');
      expect(mapSentenceLength(25).label).toBe('Detailed');
    });

    it('maps >25 words to "Very Detailed"', () => {
      expect(mapSentenceLength(26).label).toBe('Very Detailed');
      expect(mapSentenceLength(30).label).toBe('Very Detailed');
    });

    it('includes average word count in description', () => {
      const result = mapSentenceLength(15.7);
      expect(result.description).toContain('Average 16 words per sentence');
      expect(result.emoji).toBe('📏');
    });

    it('handles decimal values by rounding', () => {
      expect(mapSentenceLength(14.4).description).toContain('14 words');
      expect(mapSentenceLength(14.6).description).toContain('15 words');
    });
  });

  describe('mapStructurePreference', () => {
    it('maps bullets >60% to "Bullet-Heavy"', () => {
      const result = mapStructurePreference({ paragraphs_pct: 35, bullets_pct: 65 });
      expect(result.label).toBe('Bullet-Heavy');
      expect(result.emoji).toBe('📐');
    });

    it('maps bullets 40-60% to "Mixed"', () => {
      const result1 = mapStructurePreference({ paragraphs_pct: 60, bullets_pct: 40 });
      expect(result1.label).toBe('Mixed');

      const result2 = mapStructurePreference({ paragraphs_pct: 40, bullets_pct: 60 });
      expect(result2.label).toBe('Mixed');

      const result3 = mapStructurePreference({ paragraphs_pct: 50, bullets_pct: 50 });
      expect(result3.label).toBe('Mixed');
    });

    it('maps bullets <40% to "Paragraph-Heavy"', () => {
      const result = mapStructurePreference({ paragraphs_pct: 70, bullets_pct: 30 });
      expect(result.label).toBe('Paragraph-Heavy');
    });

    it('includes percentage breakdown in description', () => {
      const result = mapStructurePreference({ paragraphs_pct: 60, bullets_pct: 40 });
      expect(result.description).toBe('60% paragraphs, 40% bullet points');
    });

    it('handles boundary values', () => {
      expect(mapStructurePreference({ paragraphs_pct: 40, bullets_pct: 60 }).label).toBe('Mixed');
      expect(mapStructurePreference({ paragraphs_pct: 39, bullets_pct: 61 }).label).toBe('Bullet-Heavy');
    });
  });

  describe('mapTechnicalDepth', () => {
    it('maps depth 1-3 to "Beginner"', () => {
      expect(mapTechnicalDepth(1).label).toBe('Beginner');
      expect(mapTechnicalDepth(2).label).toBe('Beginner');
      expect(mapTechnicalDepth(3).label).toBe('Beginner');
    });

    it('maps depth 4-5 to "Intermediate"', () => {
      expect(mapTechnicalDepth(4).label).toBe('Intermediate');
      expect(mapTechnicalDepth(5).label).toBe('Intermediate');
    });

    it('maps depth 6-7 to "Advanced"', () => {
      expect(mapTechnicalDepth(6).label).toBe('Advanced');
      expect(mapTechnicalDepth(7).label).toBe('Advanced');
    });

    it('maps depth 8-10 to "Expert"', () => {
      expect(mapTechnicalDepth(8).label).toBe('Expert');
      expect(mapTechnicalDepth(9).label).toBe('Expert');
      expect(mapTechnicalDepth(10).label).toBe('Expert');
    });

    it('includes percentage in description', () => {
      const result = mapTechnicalDepth(6);
      expect(result.description).toContain('60%');
      expect(result.description).toContain('technical terminology');
      expect(result.emoji).toBe('🎓');
    });

    it('handles boundary values', () => {
      expect(mapTechnicalDepth(3.0).label).toBe('Beginner');
      expect(mapTechnicalDepth(3.1).label).toBe('Intermediate');
      expect(mapTechnicalDepth(5.0).label).toBe('Intermediate');
      expect(mapTechnicalDepth(5.1).label).toBe('Advanced');
      expect(mapTechnicalDepth(7.0).label).toBe('Advanced');
      expect(mapTechnicalDepth(7.1).label).toBe('Expert');
    });
  });
});
