import { query } from '../database/init.js';

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

/**
 * Classify a save item into the appropriate folder
 */
export async function classifyItem(
  userId: string,
  input: ClassificationInput
): Promise<ClassificationResult> {
  // Get user's folders
  const foldersResult = await query(
    `SELECT f.*, up.weights
     FROM folders f
     LEFT JOIN user_preferences up ON f.id = up.folder_id AND up.user_id = $1
     WHERE f.user_id = $1`,
    [userId]
  );
  
  const folders = foldersResult.rows;
  
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
  const confidence = maxScore > 0 ? Math.min(bestMatch.score / maxScore, 1) : 0;
  
  const result = {
    folderId: confidence >= 0.3 ? bestMatch.folderId : null,
    folderName: confidence >= 0.3 ? bestMatch.folderName : null,
    confidence,
    reasons: bestMatch.reasons,
    alternativeFolders: scores.slice(1, 4).map(s => ({
      folderId: s.folderId,
      folderName: s.folderName,
      confidence: maxScore > 0 ? Math.min(s.score / maxScore, 1) : 0,
    })),
  };
  
  return result;
}

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
    
    // Direct name match
    if (folderNameLower.includes(topicLower) || topicLower.includes(folderNameLower.split(' ')[0])) {
      score += 30;
      reasons.push(`Topic "${topic}" matches folder`);
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
    const categoryMatches = getCategoryForLabel(labelLower);
    if (folderNameLower.includes(categoryMatches)) {
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

function getCategoryForLabel(label: string): string {
  const mapping: { [key: string]: string } = {
    // Food
    'restaurant': 'food',
    'ramen': 'food',
    'sushi': 'food',
    'cafe': 'food',
    'cooking': 'food',
    'menu': 'food',
    'eating': 'food',
    
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

