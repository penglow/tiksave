import OpenAI from 'openai';
import axios from 'axios';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

/**
 * Step 1: Extract ONE location query string from context using OpenAI.
 */
export async function extractLocationQuery(
  text: string,
  context?: string
): Promise<string | null> {
  if (!text && !context) return null;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a location extraction assistant. Identify the most specific real-world physical location mentioned (from description, dialogue transcript, or on-screen text).
          
          Return ONLY a single search string that I can type into Google Maps.
          
          Rules:
          1. Return ANY physical location mentioned (Cities, Countries, Landmarks, Restaurants, Stores).
          2. Prefer specific landmarks, but if the text just says "Japan" or "Paris", RETURN IT.
          3. Only return "null" if there is absolutely NO location mentioned.
          4. Do not include phrases like "I think" or quotes. Just the address/name.
          5. If multiple locations are mentioned, pick the most specific one that best matches the content.
          `
        },
        {
          role: "user",
          content: `Context: "${context || ''}"\n\nText: "${text}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 60,
    });

    const query = completion.choices[0]?.message.content?.trim();
    console.log(`   🤖 AI Location Query: "${query}"`);
    if (!query || query.toLowerCase() === 'null') return null;

    // Remove "quotes" if present
    return query.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Error extracting location query:', error);
    return null;
  }
}

/**
 * Step 1b: Extract MULTIPLE location query strings from context using OpenAI.
 * Returns a de-duplicated list (max 5) of Google-Maps-searchable strings.
 */
export async function extractLocationQueries(
  text: string,
  context?: string
): Promise<string[]> {
  if (!text && !context) return [];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a location extraction assistant specialized in TikTok content.
Identify ALL distinct real-world physical locations mentioned in the provided context.
Focus heavily on:
1. Dialogue transcript (what people are saying).
2. On-screen text (OCR) - e.g., restaurant names on signs, street names, shop names.
3. Description and shared text.

Return ONLY valid JSON: an array of strings.

Rules:
1. Each string must be a searchable Google Maps query (e.g. "Shibuya Crossing", "Starbucks Kyoto Ningyo-cho", "Mount Fuji").
2. Be extremely thorough with Transcript and OCR. If you see a restaurant name or landmark in the OCR, it is a very strong signal.
3. Include multiple locations if they are mentioned (e.g. city + specific restaurant).
4. De-duplicate similar entries.
5. If no location is found, return [].
6. Limit to at most 5 locations.`,
        },
        {
          role: 'user',
          content: `Context: "${context || ''}"\n\nText: "${text}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message.content?.trim() || '[]';

    let parsed: unknown = [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: if model didn't return JSON, fall back to single extraction
      const single = await extractLocationQuery(text, context);
      return single ? [single] : [];
    }

    if (!Array.isArray(parsed)) return [];

    const cleaned = parsed
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .map((s) => s.replace(/^["']|["']$/g, ''));

    // De-duplicate (case-insensitive) and limit
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of cleaned) {
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(s);
      if (unique.length >= 5) break;
    }

    console.log(`   🤖 AI Location Queries: ${unique.length > 0 ? JSON.stringify(unique) : '[]'}`);
    return unique;
  } catch (error) {
    console.error('Error extracting location queries:', error);
    return [];
  }
}

/**
 * Step 2: Geocode the query using Google Maps Geocoding API.
 */
export async function geocodeLocation(searchQuery: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY is missing in .env');
    return null;
  }

  try {
    console.log(`   🌍 Geocoding with Google: "${searchQuery}"`);

    const url = `https://maps.googleapis.com/maps/api/geocode/json`;
    const response = await axios.get(url, {
      params: {
        address: searchQuery,
        key: GOOGLE_MAPS_API_KEY
      }
    });

    const data = response.data;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;

      // Extract a "name" - usually the first component or the formatted address partial
      // Google doesn't return a "name" field in Geocoding, mostly just address components.
      // We will try to find a meaningful name or fallback to the query.
      let name = searchQuery;

      return {
        latitude: location.lat,
        longitude: location.lng,
        name: name,
        address: result.formatted_address,
      };
    } else {
      console.log(`   ❌ Google Geocoding failed: ${data.status} - ${data.error_message || ''}`);
      return null;
    }

  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Wrapper to match previous interface
export async function extractLocationData(text: string, context?: string) {
  const query = await extractLocationQuery(text, context);
  if (!query) return null;
  return await geocodeLocation(query);
}
