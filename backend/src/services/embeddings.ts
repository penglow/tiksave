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
}): Promise<number[] | null> {
  // Combine relevant text fields
  const parts: string[] = [];
  
  if (item.title) {
    parts.push(`Title: ${item.title}`);
  }
  
  if (item.transcriptText) {
    // Take first 1000 chars of transcript
    parts.push(`Transcript: ${item.transcriptText.slice(0, 1000)}`);
  }
  
  if (item.detectedTopics && item.detectedTopics.length > 0) {
    parts.push(`Topics: ${item.detectedTopics.join(', ')}`);
  }
  
  if (item.detectedLabels && item.detectedLabels.length > 0) {
    parts.push(`Labels: ${item.detectedLabels.slice(0, 20).join(', ')}`);
  }
  
  if (item.rawSharedText) {
    // Extract hashtags and meaningful text
    const hashtags = item.rawSharedText.match(/#[\w]+/g);
    if (hashtags) {
      parts.push(`Hashtags: ${hashtags.join(' ')}`);
    }
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

