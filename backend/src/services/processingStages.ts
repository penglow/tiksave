/**
 * Processing stage tracking for video imports
 * Provides real-time feedback on processing progress
 */

export type ProcessingStage = 
  | 'queued'
  | 'downloading' 
  | 'analyzing'
  | 'extracting_location'
  | 'classifying'
  | 'saving'
  | 'ready'
  | 'error';

interface StageConfig {
  id: ProcessingStage;
  message: string;
  progress: number; // 0-100
  emoji: string;
}

export const ProcessingStages: Record<ProcessingStage, StageConfig> = {
  queued: {
    id: 'queued',
    message: 'In queue...',
    progress: 5,
    emoji: '⏳',
  },
  downloading: {
    id: 'downloading',
    message: 'Getting video info...',
    progress: 20,
    emoji: '📥',
  },
  analyzing: {
    id: 'analyzing',
    message: 'AI analyzing content...',
    progress: 45,
    emoji: '🤖',
  },
  extracting_location: {
    id: 'extracting_location',
    message: 'Finding location...',
    progress: 60,
    emoji: '📍',
  },
  classifying: {
    id: 'classifying',
    message: 'Choosing best folder...',
    progress: 75,
    emoji: '📁',
  },
  saving: {
    id: 'saving',
    message: 'Almost done...',
    progress: 90,
    emoji: '💾',
  },
  ready: {
    id: 'ready',
    message: 'Complete!',
    progress: 100,
    emoji: '✅',
  },
  error: {
    id: 'error',
    message: 'Processing failed',
    progress: 0,
    emoji: '❌',
  },
};

/**
 * Get stage configuration
 */
export function getStageConfig(stage: ProcessingStage): StageConfig {
  return ProcessingStages[stage] || ProcessingStages.queued;
}

/**
 * Get next stage in the processing pipeline
 */
export function getNextStage(currentStage: ProcessingStage): ProcessingStage | null {
  const stageOrder: ProcessingStage[] = [
    'queued',
    'downloading',
    'analyzing',
    'extracting_location',
    'classifying',
    'saving',
    'ready',
  ];
  
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) {
    return null;
  }
  
  return stageOrder[currentIndex + 1];
}

/**
 * Build SQL to update processing stage
 */
export function buildStageUpdateSQL(stage: ProcessingStage): string {
  const config = getStageConfig(stage);
  return `
    processing_stage = '${stage}',
    processing_progress = ${config.progress},
    processing_message = '${config.message}'
  `;
}

/**
 * Get processing stage display info for API response
 */
export function getStageDisplayInfo(stage: ProcessingStage): {
  stage: ProcessingStage;
  message: string;
  progress: number;
  emoji: string;
} {
  const config = getStageConfig(stage);
  return {
    stage: config.id,
    message: config.message,
    progress: config.progress,
    emoji: config.emoji,
  };
}
