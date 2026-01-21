import { query, pool } from './init';

async function run() {
  try {
    console.log('Adding video_blob_name column...');
    await query(`
      ALTER TABLE save_items
      ADD COLUMN IF NOT EXISTS video_blob_name TEXT;
    `);
    console.log('✅ video_blob_name column added successfully');
  } catch (error) {
    console.error('❌ Failed to add column:', error);
  } finally {
    await pool.end();
    process.exit();
  }
}

run();

