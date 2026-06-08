/**
 * User preference learning from folder correction training examples.
 */

// --- imports ---

import { query } from '../database/init.js';
import { invalidateUserFolderCache } from './folderCache.js';

// --- types ---

interface TrainingFeatures {
  topics: string[];
  labels: string[];
  transcriptKeywords: string[];
  hashtags: string[];
  creatorUsername?: string;
}

interface RecordTrainingInput {
  userId: string;
  itemId: string;
  originalFolderId: string | null;
  correctedFolderId: string;
  features: TrainingFeatures;
}

// --- handlers ---

/**
 * Record a training example when user corrects AI classification.
 */
export async function recordTrainingExample(input: RecordTrainingInput): Promise<void> {
  await query(
    `INSERT INTO training_examples (
      user_id, item_id, original_folder_id, corrected_folder_id, features
    ) VALUES ($1, $2, $3, $4, $5)`,
    [
      input.userId,
      input.itemId,
      input.originalFolderId,
      input.correctedFolderId,
      JSON.stringify(input.features),
    ]
  );
}

/**
 * Update user preferences based on a correction
 */
export async function updateUserPreferences(
  userId: string,
  correctFolderId: string,
  features: {
    topics: string[];
    labels: string[];
    creator?: string;
  },
  wrongFolderId?: string | null
): Promise<void> {
  // Update weights for correct folder (positive reinforcement)
  await updateFolderWeights(userId, correctFolderId, features, true);
  
  // Update weights for wrong folder (negative reinforcement)
  if (wrongFolderId) {
    await updateFolderWeights(userId, wrongFolderId, features, false);
  }
}

// --- helpers ---

async function updateFolderWeights(
  userId: string,
  folderId: string,
  features: { topics: string[]; labels: string[]; creator?: string },
  isPositive: boolean
): Promise<void> {
  // Get or create preference record
  const existing = await query(
    `SELECT weights FROM user_preferences WHERE user_id = $1 AND folder_id = $2`,
    [userId, folderId]
  );
  
  let weights = {
    topicWeights: {} as Record<string, number>,
    labelWeights: {} as Record<string, number>,
    creatorWeights: {} as Record<string, number>,
    keywordWeights: {} as Record<string, number>,
    folderBias: 0,
  };
  
  if (existing.rows.length > 0) {
    weights = { ...weights, ...existing.rows[0].weights };
  }
  
  const delta = isPositive ? 0.1 : -0.05;
  
  // Update topic weights
  for (const topic of features.topics) {
    const key = topic.toLowerCase();
    weights.topicWeights[key] = Math.max(
      -1,
      Math.min(1, (weights.topicWeights[key] || 0) + delta)
    );
  }
  
  // Update label weights
  for (const label of features.labels) {
    const key = label.toLowerCase();
    weights.labelWeights[key] = Math.max(
      -1,
      Math.min(1, (weights.labelWeights[key] || 0) + delta)
    );
  }
  
  // Update creator weights (stronger signal)
  if (features.creator) {
    const key = features.creator.toLowerCase();
    weights.creatorWeights[key] = Math.max(
      -1,
      Math.min(1, (weights.creatorWeights[key] || 0) + delta * 2)
    );

    // Check if we should create a hard rule for this creator (3+ corrections)
    if (isPositive) {
      const history = await query(
        `SELECT COUNT(*) as count FROM training_examples 
         WHERE user_id = $1 AND corrected_folder_id = $2 
         AND features->>'creatorUsername' = $3`,
        [userId, folderId, features.creator]
      );
      
      if (parseInt(history.rows[0].count) >= 2) { // Already have current one + 2 others = 3 total
        await addCreatorRule(userId, folderId, features.creator);
      }
    }
  }
  
  // Update folder bias
  weights.folderBias = Math.max(
    -0.5,
    Math.min(0.5, weights.folderBias + (isPositive ? 0.02 : -0.01))
  );
  
  // Upsert preference record
  await query(
    `INSERT INTO user_preferences (user_id, folder_id, weights, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, folder_id)
     DO UPDATE SET weights = $3, updated_at = NOW()`,
    [userId, folderId, JSON.stringify(weights)]
  );
  
  // Invalidate classification cache since preferences affect classification
  await invalidateUserFolderCache(userId);
}

/**
 * Get aggregated learning statistics for a user
 */
export async function getLearningStats(userId: string): Promise<{
  totalCorrections: number;
  accuracyImprovement: number;
  topMistakes: Array<{ from: string; to: string; count: number }>;
}> {
  // Count total corrections
  const countResult = await query(
    `SELECT COUNT(*) as count FROM training_examples WHERE user_id = $1`,
    [userId]
  );
  
  // Find common misclassifications
  const mistakesResult = await query(
    `SELECT 
      f1.name as from_folder,
      f2.name as to_folder,
      COUNT(*) as count
     FROM training_examples te
     LEFT JOIN folders f1 ON te.original_folder_id = f1.id
     JOIN folders f2 ON te.corrected_folder_id = f2.id
     WHERE te.user_id = $1 AND te.original_folder_id IS NOT NULL
     GROUP BY f1.name, f2.name
     ORDER BY count DESC
     LIMIT 5`,
    [userId]
  );
  
  // Calculate accuracy improvement (simplified metric)
  // Compare recent accuracy vs initial accuracy
  const recentResult = await query(
    `SELECT 
      COUNT(CASE WHEN original_folder_id = corrected_folder_id THEN 1 END) as correct,
      COUNT(*) as total
     FROM training_examples 
     WHERE user_id = $1
     AND created_at > NOW() - INTERVAL '7 days'`,
    [userId]
  );
  
  const accuracyImprovement = recentResult.rows[0].total > 0
    ? (recentResult.rows[0].correct / recentResult.rows[0].total) * 100
    : 0;
  
  return {
    totalCorrections: parseInt(countResult.rows[0].count),
    accuracyImprovement,
    topMistakes: mistakesResult.rows.map(row => ({
      from: row.from_folder || 'Inbox',
      to: row.to_folder,
      count: parseInt(row.count),
    })),
  };
}

async function addCreatorRule(userId: string, folderId: string, creator: string) {
  // Get current rules
  const res = await query('SELECT rules FROM folders WHERE id = $1', [folderId]);
  if (res.rows.length === 0) return;
  
  let rules = res.rows[0].rules || {};
  
  if (!rules.creators) {
    rules.creators = [];
  }
  
  if (!rules.creators.includes(creator)) {
    rules.creators.push(creator);
    
    await query(
      'UPDATE folders SET rules = $1 WHERE id = $2',
      [rules, folderId]
    );
  }
}

/**
 * Generate automatic rules from training examples
 */
export async function generateRulesFromTraining(
  userId: string,
  folderId: string
): Promise<Array<{ field: string; value: string; confidence: number }>> {
  const result = await query(
    `SELECT features FROM training_examples
     WHERE user_id = $1 AND corrected_folder_id = $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId, folderId]
  );
  
  if (result.rows.length < 3) {
    return []; // Not enough data
  }
  
  // Aggregate feature occurrences
  const topicCounts: Record<string, number> = {};
  const labelCounts: Record<string, number> = {};
  const creatorCounts: Record<string, number> = {};
  const hashtagCounts: Record<string, number> = {};
  
  for (const row of result.rows) {
    const features = row.features as TrainingFeatures;
    
    for (const topic of features.topics || []) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
    
    for (const label of features.labels || []) {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    }
    
    if (features.creatorUsername) {
      creatorCounts[features.creatorUsername] = (creatorCounts[features.creatorUsername] || 0) + 1;
    }
    
    for (const hashtag of features.hashtags || []) {
      hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1;
    }
  }
  
  const rules: Array<{ field: string; value: string; confidence: number }> = [];
  const totalExamples = result.rows.length;
  
  // Generate rules for frequently occurring features
  const minOccurrenceRatio = 0.5;
  
  for (const [topic, count] of Object.entries(topicCounts)) {
    const ratio = count / totalExamples;
    if (ratio >= minOccurrenceRatio) {
      rules.push({ field: 'topic', value: topic, confidence: ratio });
    }
  }
  
  for (const [label, count] of Object.entries(labelCounts)) {
    const ratio = count / totalExamples;
    if (ratio >= minOccurrenceRatio) {
      rules.push({ field: 'label', value: label, confidence: ratio });
    }
  }
  
  for (const [creator, count] of Object.entries(creatorCounts)) {
    const ratio = count / totalExamples;
    if (ratio >= minOccurrenceRatio * 0.8) { // Lower threshold for creators
      rules.push({ field: 'creator', value: creator, confidence: ratio });
    }
  }
  
  return rules.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

