import { Router, Response } from 'express';
import { query } from '../database/init.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateEmbedding } from '../services/embeddings.js';
import { getOpenAIClient, isOpenAIConfigured, withRetry } from '../services/openai.js';

/**
 * Enhance search query with context understanding
 * Converts simple queries like "chicken" into context-rich queries
 * that better match semantic meaning
 */
async function enhanceSearchQuery(searchQuery: string): Promise<string> {
  if (!isOpenAIConfigured() || searchQuery.length < 2) {
    return searchQuery; // Return original if no API key or too short
  }

  try {
    const openai = getOpenAIClient();
    const prompt = `Transform this search query into a natural, context-rich description that captures what the user is looking for.

The goal is to understand the intent and context behind the search, not just match keywords.

Examples:
- "chicken" → "videos about chicken, fried chicken, chicken recipes, chicken restaurants, or chicken food content"
- "tokyo" → "videos about Tokyo, Tokyo travel, Tokyo food, Tokyo attractions, or Tokyo experiences"
- "cooking" → "videos about cooking, recipes, cooking tutorials, cooking tips, or food preparation"
- "popeyes" → "videos about Popeyes restaurant, Popeyes food, Popeyes reviews, or Popeyes chicken"

Search query: "${searchQuery}"

Respond with just the enhanced query description (no labels, no JSON, just natural language):`;

    const response = await withRetry(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 100,
      })
    );

    const enhanced = response.choices[0]?.message?.content?.trim();
    return enhanced || searchQuery; // Fallback to original if enhancement fails
  } catch (error) {
    console.warn('Failed to enhance search query, using original:', error);
    return searchQuery; // Fallback to original query
  }
}

export const searchRouter = Router();

// Search items
searchRouter.get('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { q, semantic = 'true', limit = '20' } = req.query;
  
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.json({ items: [], total: 0 });
  }
  
  const searchQuery = q.trim();
  const useSemanticSearch = semantic === 'true';
  const resultLimit = Math.min(parseInt(limit as string) || 20, 100);
  
  let items: any[] = [];
  
  if (useSemanticSearch) {
    // Semantic search using embeddings
    items = await semanticSearch(authReq.userId, searchQuery, resultLimit);
  }
  
  // If semantic search returned no results or is disabled, fall back to keyword search
  if (items.length === 0) {
    items = await keywordSearch(authReq.userId, searchQuery, resultLimit);
  }
  
  res.json({
    items: items.map(formatSearchResult),
    total: items.length,
  });
});

// Semantic search using pgvector
async function semanticSearch(userId: string, searchQuery: string, limit: number) {
  try {
    // Enhance search query with context understanding using OpenAI
    const enhancedQuery = await enhanceSearchQuery(searchQuery);
    
    // Generate embedding for enhanced search query (with caching for frequent searches)
    const embedding = await generateEmbedding(enhancedQuery, true);
    
    if (!embedding) {
      return [];
    }
    
    // Search using cosine similarity
    const result = await query(
      `SELECT si.*, f.name as folder_name,
        1 - (si.embedding <=> $1::vector) as similarity
       FROM save_items si
       LEFT JOIN folders f ON si.folder_id = f.id
       WHERE si.user_id = $2 
         AND si.deleted_at IS NULL
         AND si.embedding IS NOT NULL
         AND si.status = 'ready'
       ORDER BY si.embedding <=> $1::vector
       LIMIT $3`,
      [`[${embedding.join(',')}]`, userId, limit]
    );
    
    // Filter by minimum similarity threshold
    return result.rows.filter(row => row.similarity > 0.5);
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

// Escape special characters for PostgreSQL tsquery
function escapeTsQueryTerm(term: string): string {
  // Remove or escape special tsquery characters: & | ! ( ) : ' \ *
  // Keep only alphanumeric and common punctuation that's safe
  return term.replace(/[&|!():'\\*<>]/g, '').trim();
}

// Keyword search using PostgreSQL full-text search
async function keywordSearch(userId: string, searchQuery: string, limit: number) {
  // Prepare search terms - escape special characters to prevent injection
  const terms = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .map(term => escapeTsQueryTerm(term))
    .filter(term => term.length > 1)
    .map(term => term + ':*')
    .join(' & ');
  
  if (!terms) {
    return [];
  }
  
  const result = await query(
    `SELECT si.*, f.name as folder_name,
      ts_rank(
        to_tsvector('english', 
          COALESCE(si.title, '') || ' ' || 
          COALESCE(si.transcript_text, '') || ' ' || 
          COALESCE(si.raw_shared_text, '') || ' ' ||
          COALESCE(array_to_string(si.detected_topics, ' '), '') || ' ' ||
          COALESCE(array_to_string(si.detected_labels, ' '), '')
        ),
        to_tsquery('english', $1)
      ) as rank
     FROM save_items si
     LEFT JOIN folders f ON si.folder_id = f.id
     WHERE si.user_id = $2 
       AND si.deleted_at IS NULL
       AND si.status = 'ready'
       AND (
         to_tsvector('english', 
           COALESCE(si.title, '') || ' ' || 
           COALESCE(si.transcript_text, '') || ' ' || 
           COALESCE(si.raw_shared_text, '') || ' ' ||
           COALESCE(array_to_string(si.detected_topics, ' '), '') || ' ' ||
           COALESCE(array_to_string(si.detected_labels, ' '), '')
         ) @@ to_tsquery('english', $1)
         OR si.title ILIKE $3
         OR si.transcript_text ILIKE $3
         OR si.raw_shared_text ILIKE $3
         OR si.creator_username ILIKE $3
       )
     ORDER BY rank DESC, si.created_at DESC
     LIMIT $4`,
    [terms, userId, `%${searchQuery}%`, limit]
  );
  
  return result.rows;
}

function formatSearchResult(row: any) {
  return {
    id: row.id,
    sourceURL: row.source_url,
    dateAdded: row.created_at,
    rawSharedText: row.raw_shared_text,
    status: row.status,
    thumbnailURL: row.thumbnail_url,
    transcriptText: row.transcript_text,
    detectedTopics: row.detected_topics || [],
    detectedLabels: row.detected_labels || [],
    predictedFolderId: row.predicted_folder_id,
    confidence: row.confidence != null ? parseFloat(row.confidence) : undefined,
    folderId: row.folder_id,
    folderName: row.folder_name,
    title: row.title,
    duration: row.duration ? parseFloat(row.duration) : null,
    creatorName: row.creator_name,
    creatorUsername: row.creator_username,
    similarity: row.similarity ? parseFloat(row.similarity) : undefined,
  };
}
