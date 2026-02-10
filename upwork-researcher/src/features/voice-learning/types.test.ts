// Story 8.6: Tests for voice learning types and utility functions

import { describe, it, expect } from 'vitest';
import { getVoiceLearningStatus } from './types';

describe('getVoiceLearningStatus', () => {
  // Subtask 5.2: Test progress indicator shows correct status for 0, 3, 5, 10, 15 proposals

  it('returns initial status for 0 proposals', () => {
    const result = getVoiceLearningStatus(0);
    expect(result).toEqual({
      proposalsEditedCount: 0,
      status: 'initial',
      progressPercent: 0,
    });
  });

  it('returns learning status for 1-4 proposals', () => {
    const result = getVoiceLearningStatus(3);
    expect(result).toEqual({
      proposalsEditedCount: 3,
      status: 'learning',
      progressPercent: 30, // 3/10 * 100
    });
  });

  it('returns refining status for 5-9 proposals', () => {
    const result = getVoiceLearningStatus(5);
    expect(result).toEqual({
      proposalsEditedCount: 5,
      status: 'refining',
      progressPercent: 50, // 5/10 * 100
    });

    const result9 = getVoiceLearningStatus(9);
    expect(result9).toEqual({
      proposalsEditedCount: 9,
      status: 'refining',
      progressPercent: 90,
    });
  });

  it('returns personalized status for 10+ proposals', () => {
    const result10 = getVoiceLearningStatus(10);
    expect(result10).toEqual({
      proposalsEditedCount: 10,
      status: 'personalized',
      progressPercent: 100,
    });

    const result15 = getVoiceLearningStatus(15);
    expect(result15).toEqual({
      proposalsEditedCount: 15,
      status: 'personalized',
      progressPercent: 100,
    });
  });

  // Subtask 5.3: Test progress percent calculation is accurate
  it('calculates progress percent correctly', () => {
    expect(getVoiceLearningStatus(1).progressPercent).toBe(10);
    expect(getVoiceLearningStatus(2).progressPercent).toBe(20);
    expect(getVoiceLearningStatus(4).progressPercent).toBe(40);
    expect(getVoiceLearningStatus(7).progressPercent).toBe(70);
  });

  it('caps progress percent at 100 for counts >= 10', () => {
    expect(getVoiceLearningStatus(10).progressPercent).toBe(100);
    expect(getVoiceLearningStatus(100).progressPercent).toBe(100);
  });
});
