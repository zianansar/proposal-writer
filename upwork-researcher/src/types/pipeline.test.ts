import { describe, it, expect } from 'vitest';
import {
  PIPELINE_STAGES,
  type StageStatus,
  type PipelineStage,
  type StageId,
} from './pipeline';

describe('pipeline types', () => {
  it('defines all required stage statuses', () => {
    const statuses: StageStatus[] = ['pending', 'active', 'complete', 'error'];

    statuses.forEach((status) => {
      const stage: PipelineStage = {
        id: 'test',
        label: 'Test',
        status,
      };
      expect(stage.status).toBe(status);
    });
  });

  it('defines MVP pipeline stages in correct order', () => {
    expect(PIPELINE_STAGES).toHaveLength(3);
    expect(PIPELINE_STAGES[0].id).toBe('preparing');
    expect(PIPELINE_STAGES[1].id).toBe('generating');
    expect(PIPELINE_STAGES[2].id).toBe('complete');
  });

  it('pipeline stages have required properties', () => {
    PIPELINE_STAGES.forEach((stage) => {
      expect(stage).toHaveProperty('id');
      expect(stage).toHaveProperty('label');
      expect(typeof stage.id).toBe('string');
      expect(typeof stage.label).toBe('string');
    });
  });

  it('PipelineStage type allows optional durationMs', () => {
    const stage: PipelineStage = {
      id: 'preparing',
      label: 'Preparing...',
      status: 'complete',
      durationMs: 500,
    };
    expect(stage.durationMs).toBe(500);
  });

  it('PipelineStage type allows optional error', () => {
    const stage: PipelineStage = {
      id: 'generating',
      label: 'Generating...',
      status: 'error',
      error: 'API timeout',
    };
    expect(stage.error).toBe('API timeout');
  });

  it('StageId type is constrained to pipeline stage ids', () => {
    const validIds: StageId[] = ['preparing', 'generating', 'complete'];
    validIds.forEach((id) => {
      expect(PIPELINE_STAGES.some((stage) => stage.id === id)).toBe(true);
    });
  });
});
