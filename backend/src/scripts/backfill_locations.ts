/** Backfill script — geocode location data for existing save items missing coordinates. */

// --- imports ---

import 'dotenv/config';
import { pool, query } from '../database/init.js';
import { extractLocationData } from '../services/location.js';

// --- handlers ---

async function backfill() {
  console.log('🌍 Starting location backfill...');

  try {
    const res = await query(`
      SELECT id, title, transcript_text, detected_topics, insights_json 
      FROM save_items 
      WHERE latitude IS NULL 
      AND (
         transcript_text IS NOT NULL OR 
         title IS NOT NULL OR 
         insights_json IS NOT NULL
      )
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const items = res.rows;
    console.log(`Found ${items.length} items to check for locations.`);

    for (const item of items) {
      console.log(`\nProcessing: "${item.title?.substring(0, 30)}..." (${item.id})`);

      const topics = item.detected_topics || [];
      const description = item.insights_json?.description || '';

      const contextText = `Title: ${item.title || ''}. 
                           Description: ${description.substring(0, 200)}. 
                           Transcript: ${item.transcript_text?.substring(0, 300) || ''}. 
                           Topics: ${topics.join(', ')}`;

      const locationData = await extractLocationData(item.title || description || '', contextText);

      if (locationData) {
        console.log(`   ✅ Found: ${locationData.name} (${locationData.address})`);

        await query(`
          UPDATE save_items 
          SET 
            latitude = $1, 
            longitude = $2, 
            location_name = $3, 
            address = $4,
            updated_at = NOW()
          WHERE id = $5
        `, [
          locationData.latitude,
          locationData.longitude,
          locationData.name,
          locationData.address,
          item.id,
        ]);
      } else {
        console.log('   ❌ No location found.');
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    console.log('\n✨ Backfill complete!');
  } catch (error) {
    console.error('Backfill failed:', error);
  } finally {
    await pool.end();
  }
}

backfill();
