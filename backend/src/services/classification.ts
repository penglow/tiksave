/**
 * Save-item folder classification using topic, label, hashtag, and learned weights.
 */

// --- imports ---

import { query } from '../database/init.js';
import { createOrFindFolder } from './folderCreation.js';
import { getUserFoldersForClassification } from './folderCache.js';

// --- types ---

interface ClassificationInput {
  topics: string[];
  labels: string[];
  transcriptText?: string;
  hashtags: string[];
  creatorUsername?: string;
}

interface ClassificationResult {
  folderId: string | null;
  folderName: string | null;
  confidence: number;
  reasons: string[];
  alternativeFolders: Array<{
    folderId: string;
    folderName: string;
    confidence: number;
  }>;
}

// --- handlers ---

/**
 * Classify a save item into the appropriate folder.
 */
export async function classifyItem(
  userId: string,
  input: ClassificationInput
): Promise<ClassificationResult> {
  // Get user's folders from cache (includes parent folder info and preference weights)
  const folders = await getUserFoldersForClassification(userId);

  return classifyItemWithFolders(userId, folders, input);
}

/**
 * Validated classification logic separated from data fetching
 */
export async function classifyItemWithFolders(
  userId: string,
  folders: any[],
  input: ClassificationInput
): Promise<ClassificationResult> {
  if (folders.length === 0) {
    return {
      folderId: null,
      folderName: null,
      confidence: 0,
      reasons: ['No folders available'],
      alternativeFolders: [],
    };
  }

  // Score each folder
  const scores: Array<{
    folderId: string;
    folderName: string;
    score: number;
    reasons: string[];
  }> = [];

  for (const folder of folders) {
    const { score, reasons } = scoreFolder(folder, input);
    scores.push({
      folderId: folder.id,
      folderName: folder.name,
      score,
      reasons,
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const bestMatch = scores[0];
  const maxScore = calculateMaxPossibleScore(input);

  // Check if we have any meaningful input signals
  const hasInputSignals =
    (input.topics && input.topics.length > 0) ||
    (input.labels && input.labels.length > 0) ||
    (input.hashtags && input.hashtags.length > 0) ||
    input.creatorUsername ||
    input.transcriptText;

  // Don't assign if:
  // 1. Best match has score 0 (no actual matches)
  // 2. No input signals at all (can't make a meaningful classification)
  // 3. Confidence is below threshold
  const confidence = maxScore > 0 ? Math.min(bestMatch.score / maxScore, 1) : 0;
  const shouldAssign =
    bestMatch.score > 0 &&
    hasInputSignals &&
    confidence >= 0.3;

  // If no good match found but we have hierarchical topics, try creating the folder
  if (!shouldAssign && input.topics && input.topics.length > 0) {
    // Check for hierarchical topics (e.g., "Food > Cooking")
    const hierarchicalTopic = input.topics.find(t => t.includes(' > '));
    if (hierarchicalTopic) {
      try {
        console.log(`   📁 No matching folder found, attempting to create folder for: ${hierarchicalTopic}`);
        const createdFolder = await createOrFindFolder(
          userId,
          input.topics,
          input.labels,
          hierarchicalTopic
        );

        if (createdFolder) {
          console.log(`   ✅ Created/found folder: ${createdFolder.folderName}`);
          return {
            folderId: createdFolder.folderId,
            folderName: createdFolder.folderName,
            confidence: 0.5, // Medium confidence for newly created folders
            reasons: [`Created folder "${createdFolder.folderName}" based on topic "${hierarchicalTopic}"`],
            alternativeFolders: [],
          };
        }
      } catch (error) {
        console.error('   ⚠️ Failed to create folder:', error);
      }
    }
  }

  const result = {
    folderId: shouldAssign ? bestMatch.folderId : null,
    folderName: shouldAssign ? bestMatch.folderName : null,
    confidence,
    reasons: bestMatch.reasons.length > 0 ? bestMatch.reasons : ['No matches found'],
    alternativeFolders: scores.slice(1, 4).map(s => ({
      folderId: s.folderId,
      folderName: s.folderName,
      confidence: maxScore > 0 ? Math.min(s.score / maxScore, 1) : 0,
    })),
  };

  return result;
}

// --- helpers ---

function scoreFolder(folder: any, input: ClassificationInput): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];
  const folderNameLower = folder.name.toLowerCase();
  const userWeights = folder.weights || {};
  const rules = folder.rules || {}; // Check for rules

  // HARD RULES (Deterministic)
  // Check creator rules
  if (rules.creators && input.creatorUsername) {
    if (rules.creators.includes(input.creatorUsername)) {
      return {
        score: 10000,
        reasons: [`Rule: Creator ${input.creatorUsername} always goes here`]
      };
    }
  }

  // Topic matching (high weight)
  for (const topic of input.topics) {
    const topicLower = topic.toLowerCase();

    // Check for hierarchical topics (e.g., "Food > Cooking")
    if (topic.includes(' > ')) {
      const [parentTopic, subTopic] = topic.split(' > ').map(t => t.trim().toLowerCase());
      const folderParentName = folder.parent_name ? folder.parent_name.toLowerCase() : null;

      // Match subfolder: parent matches AND subfolder name matches
      if (folderParentName && folderParentName === parentTopic && folderNameLower === subTopic) {
        score += 50; // High score for exact hierarchical match
        reasons.push(`Hierarchical topic "${topic}" exactly matches subfolder`);
      } else if (folderParentName && folderParentName === parentTopic && folderNameLower.includes(subTopic)) {
        score += 40; // Good match for parent + partial subfolder match
        reasons.push(`Hierarchical topic "${topic}" matches parent and subfolder`);
      } else if (folderNameLower === subTopic && !folder.parent_id) {
        // Subfolder name matches but no parent - still good match
        score += 35;
        reasons.push(`Subcategory "${subTopic}" matches folder`);
      }
    }

    let matched = false;

    // Direct name match
    if (folderNameLower.includes(topicLower) || topicLower.includes(folderNameLower.split(' ')[0])) {
      score += 30;
      reasons.push(`Topic "${topic}" matches folder`);
      matched = true;
    }

    // Check semantic category for topic
    if (!matched) {
      const semanticCategory = getSemanticCategory(topicLower);
      if (semanticCategory && folderNameLower.includes(semanticCategory)) {
        score += 30; // High score for semantic equivalent
        reasons.push(`Topic "${topic}" implies ${semanticCategory}`);
        matched = true;
      }
    }

    // Check subfolder patterns (e.g., "Japan Food" for topic "Japan")
    const parentTopic = folderNameLower.split(' ')[0];
    if (topicLower === parentTopic) {
      score += 20;
      reasons.push(`Topic "${topic}" matches parent category`);
    }

    // User learned weights
    if (userWeights.topicWeights?.[topicLower]) {
      score += userWeights.topicWeights[topicLower] * 20;
      reasons.push(`Learned preference for "${topic}"`);
    }
  }

  // Label matching (medium weight)
  for (const label of input.labels) {
    const labelLower = label.toLowerCase();

    // Check category keywords
    const categoryMatches = getSemanticCategory(labelLower);
    if (categoryMatches && folderNameLower.includes(categoryMatches)) {
      score += 15;
      reasons.push(`Label "${label}" indicates ${categoryMatches}`);
    }

    // User learned weights
    if (userWeights.labelWeights?.[labelLower]) {
      score += userWeights.labelWeights[labelLower] * 15;
    }
  }

  // Hashtag matching (medium weight)
  for (const hashtag of input.hashtags) {
    const hashtagClean = hashtag.replace('#', '').toLowerCase();

    if (folderNameLower.includes(hashtagClean)) {
      score += 10;
      reasons.push(`Hashtag ${hashtag} matches folder`);
    }

    // Check category inference from hashtag
    const category = getCategoryForHashtag(hashtagClean);
    if (category && folderNameLower.includes(category)) {
      score += 8;
      reasons.push(`Hashtag ${hashtag} suggests ${category}`);
    }
  }

  // Creator matching (high weight - creators are consistent)
  if (input.creatorUsername) {
    const creatorKey = input.creatorUsername.toLowerCase();
    if (userWeights.creatorWeights?.[creatorKey]) {
      score += userWeights.creatorWeights[creatorKey] * 25;
      reasons.push(`Creator ${input.creatorUsername} often filed here`);
    }
  }

  // Transcript keyword matching (lower weight)
  if (input.transcriptText) {
    const transcriptLower = input.transcriptText.toLowerCase();
    const folderKeywords = getFolderKeywords(folder.name);

    for (const keyword of folderKeywords) {
      if (transcriptLower.includes(keyword)) {
        score += 5;
        reasons.push(`Transcript mentions "${keyword}"`);
      }
    }
  }

  // Apply folder bias from user preferences
  if (userWeights.folderBias) {
    score += userWeights.folderBias * 10;
  }

  // Coverage Penalty: Check if the folder name is fully supported by the input
  // This prevents broader folder names (e.g., "Japan Shopping") from capturing generic items (e.g., "Shopping")
  const folderTokens = folderNameLower.split(/[\s-_]+/).filter((t: string) => t.length > 2); // Ignore short words

  if (folderTokens.length > 1 && score > 0) {
    const inputFeatures = new Set<string>();

    // Add all input signals
    input.topics.forEach(t => {
      const lower = t.toLowerCase();
      inputFeatures.add(lower);
      // Expand semantic categories for topics too (e.g. "Tokyo" -> "japan")
      const cat = getSemanticCategory(lower);
      if (cat) inputFeatures.add(cat);
    });

    input.labels.forEach(l => {
      const lower = l.toLowerCase();
      inputFeatures.add(lower);
      const cat = getSemanticCategory(lower);
      if (cat) inputFeatures.add(cat);
    });
    input.hashtags.forEach(h => {
      const lower = h.replace('#', '').toLowerCase();
      inputFeatures.add(lower);
      const cat = getCategoryForHashtag(lower);
      if (cat) inputFeatures.add(cat);
    });
    if (input.creatorUsername) inputFeatures.add(input.creatorUsername.toLowerCase());

    let matchedCount = 0;
    for (const token of folderTokens) {
      let isMatched = false;
      for (const feature of inputFeatures) {
        // Check for partial matches (e.g. "japanese" covers "japan", "shopping" covers "shopping")
        if (feature.includes(token) || token.includes(feature)) {
          isMatched = true;
          break;
        }
      }
      if (isMatched) matchedCount++;
    }

    const coverage = matchedCount / folderTokens.length;

    // If not fully covered, apply quadratic penalty
    // Example: "Japan Shopping" (2 tokens) vs "Shopping" (match 1)
    // coverage = 0.5 -> multiplier = 0.25
    if (coverage < 1.0) {
      const multiplier = Math.pow(coverage, 2);
      // Only apply penalty if it significantly reduces score (avoid float noise)
      if (multiplier < 0.9) {
        score *= multiplier;
        reasons.push(`Partial name match (${matchedCount}/${folderTokens.length} terms): score reduced`);
      }
    }
  }

  return { score, reasons: reasons.slice(0, 5) }; // Limit reasons
}

function calculateMaxPossibleScore(input: ClassificationInput): number {
  // Estimate maximum possible score based on available signals
  let maxScore = 0;

  maxScore += input.topics.length * 30;
  maxScore += input.labels.length * 15;
  maxScore += input.hashtags.length * 10;
  maxScore += input.creatorUsername ? 25 : 0;
  maxScore += input.transcriptText ? 20 : 0;

  return Math.max(maxScore, 50); // Minimum baseline
}

function getSemanticCategory(label: string): string {
  const mapping: { [key: string]: string } = {
    // Food
    'food': 'food',
    'fast food': 'food',
    'burger': 'food',
    'pizza': 'food',
    'dessert': 'food',
    'soda': 'food',
    'drink': 'food',
    'coffee': 'food',
    'restaurant': 'food',
    'ramen': 'food',
    'sushi': 'food',
    'cafe': 'food',
    'cooking': 'food',
    'menu': 'food',
    'eating': 'food',

    // Locations
    'tokyo': 'japan',
    'osaka': 'japan',
    'kyoto': 'japan',
    'seoul': 'korea',

    // Hotels
    'hotel': 'hotels',
    'room': 'hotels',
    'lobby': 'hotels',
    'ryokan': 'hotels',
    'hostel': 'hotels',

    // Attractions
    'temple': 'attractions',
    'shrine': 'attractions',
    'museum': 'attractions',
    'park': 'attractions',
    'landmark': 'attractions',
    'tour': 'attractions',

    // Shopping
    'shopping': 'shopping',
    'mall': 'shopping',
    'store': 'shopping',
    'market': 'shopping',
    'haul': 'shopping',
    'boutique': 'shopping',
    // Fashion
    'clothing': 'fashion',
    'fashion': 'fashion',
    'style': 'fashion',
    't-shirt': 'fashion',
    'pants': 'fashion',
    'shoes': 'fashion',
    'outfit': 'fashion',
  };

  return mapping[label] || '';
}

function getCategoryForHashtag(hashtag: string): string {
  const mapping: { [key: string]: string } = {
    'foodie': 'food',
    'yummy': 'food',
    'delicious': 'food',
    'eats': 'food',

    'hotelroom': 'hotels',
    'roomtour': 'hotels',
    'staycation': 'hotels',

    'sightseeing': 'attractions',
    'exploring': 'attractions',
    'wanderlust': 'attractions',

    'haul': 'shopping',
    'shopwithme': 'shopping',
    'shopping': 'shopping',
  };

  return mapping[hashtag] || '';
}

function getFolderKeywords(folderName: string): string[] {
  const name = folderName.toLowerCase();
  const keywords: string[] = [];

  // Add folder name parts as keywords
  keywords.push(...name.split(' '));

  // Add related keywords based on folder type
  if (name.includes('food')) {
    keywords.push('eat', 'restaurant', 'delicious', 'taste', 'menu', 'chef');
  }
  if (name.includes('hotel')) {
    keywords.push('stay', 'room', 'check in', 'book', 'reservation');
  }
  if (name.includes('attraction')) {
    keywords.push('visit', 'see', 'amazing', 'beautiful', 'historic');
  }
  if (name.includes('shopping')) {
    keywords.push('buy', 'store', 'price', 'sale', 'shop');
  }
  if (name.includes('japan')) {
    keywords.push('tokyo', 'osaka', 'kyoto', 'japanese', 'yen');
  }
  if (name.includes('korea')) {
    keywords.push('seoul', 'korean', 'gangnam', 'won');
  }

  return keywords;
}

