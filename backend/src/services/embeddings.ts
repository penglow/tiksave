import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for text using OpenAI's embedding model
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, skipping embedding generation');
    return null;
  }
  
  try {
    // Truncate text if too long (model has token limits)
    const truncatedText = text.slice(0, 8000);
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText,
      dimensions: 1536, // Standard dimension for this model
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Generate embedding for a save item by combining its key features
 */
export async function generateItemEmbedding(item: {
  title?: string;
  transcriptText?: string;
  detectedTopics?: string[];
  detectedLabels?: string[];
  rawSharedText?: string;
  semanticContext?: string;
  // Legacy support
  semanticKeywords?: string[];
  semanticDescription?: string;
}): Promise<number[] | null> {
  // Prioritize semantic context - it provides rich, natural language understanding
  // If semantic context exists, use it as the primary source with minimal additional context
  if (item.semanticContext && item.semanticContext.trim()) {
    // Use semantic context as the main content, with title for additional context
    const contextParts: string[] = [];
    
    if (item.title) {
      contextParts.push(item.title);
    }
    
    // Add the rich semantic context - this captures meaning, not just keywords
    contextParts.push(item.semanticContext);
    
    // Optionally add transcript if it adds significant value (first 500 chars to avoid overwhelming)
    if (item.transcriptText && item.transcriptText.length > 100) {
      contextParts.push(item.transcriptText.slice(0, 500));
    }
    
    const combinedText = contextParts.join('\n\n');
    return generateEmbedding(combinedText);
  }
  
  // Fallback: Combine relevant text fields (for videos without semantic context)
  const parts: string[] = [];
  
  if (item.title) {
    parts.push(`Title: ${item.title}`);
  }
  
  if (item.transcriptText) {
    // Take first 1500 chars of transcript for better context
    parts.push(`Transcript: ${item.transcriptText.slice(0, 1500)}`);
  }
  
  if (item.detectedTopics && item.detectedTopics.length > 0) {
    parts.push(`Topics: ${item.detectedTopics.join(', ')}`);
  }
  
  if (item.detectedLabels && item.detectedLabels.length > 0) {
    parts.push(`Labels: ${item.detectedLabels.slice(0, 20).join(', ')}`);
  }
  
  if (item.rawSharedText) {
    // Extract meaningful text (not just hashtags)
    const withoutHashtags = item.rawSharedText.replace(/#[\w]+/g, '').trim();
    if (withoutHashtags.length > 10) {
      parts.push(`Description: ${withoutHashtags.slice(0, 300)}`);
    }
  }
  
  // Legacy support for old format
  if (item.semanticDescription) {
    parts.push(item.semanticDescription);
  }
  
  if (parts.length === 0) {
    return null;
  }
  
  const combinedText = parts.join('\n');
  return generateEmbedding(combinedText);
}

/**
 * Compute cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

