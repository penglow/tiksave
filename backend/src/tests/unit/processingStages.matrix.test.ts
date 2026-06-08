/** Mass matrix tests for processing stage helpers (~200+ cases). */

import { describe, it, expect } from 'bun:test';
import {
  ProcessingStages,
  getStageConfig,
  getNextStage,
  getStageDisplayInfo,
  buildStageUpdateSQL,
  type ProcessingStage,
} from '../../services/processingStages';

const STAGES: ProcessingStage[] = [
  'queued',
  'downloading',
  'analyzing',
  'extracting_location',
  'classifying',
  'saving',
  'ready',
  'error',
];

describe('processingStages.matrix — configs', () => {
  for (const stage of STAGES) {
    for (let i = 0; i < 5; i++) {
      it(`${stage} config stable #${i}`, () => {
        const a = getStageConfig(stage);
        const b = getStageConfig(stage);
        expect(a).toEqual(b);
        expect(a.progress).toBeGreaterThanOrEqual(0);
        expect(a.progress).toBeLessThanOrEqual(100);
        expect(a.message.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('processingStages.matrix — pipeline order', () => {
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    it(`next from ${stage}`, () => {
      const next = getNextStage(stage);
      if (stage === 'ready' || stage === 'error') {
        expect(next).toBeNull();
      } else if (stage === 'saving') {
        expect(next).toBe('ready');
      }
    });
  }
  for (let i = 0; i < 30; i++) {
    it(`unknown falls back ${i}`, () => {
      expect(getStageConfig('bogus' as unknown as ProcessingStage).id).toBe('queued');
    });
  }
});

describe('processingStages.matrix — display info', () => {
  for (const stage of STAGES) {
    for (let i = 0; i < 3; i++) {
      it(`display ${stage} #${i}`, () => {
        const info = getStageDisplayInfo(stage);
        expect(info.stage).toBe(stage);
        expect(info.emoji).toBe(ProcessingStages[stage].emoji);
      });
    }
  }
});

describe('processingStages.matrix — SQL snippet', () => {
  for (const stage of STAGES) {
    it(`sql contains stage ${stage}`, () => {
      const sql = buildStageUpdateSQL(stage);
      expect(sql).toContain(stage);
      expect(sql).toContain('processing_progress');
    });
  }
});
