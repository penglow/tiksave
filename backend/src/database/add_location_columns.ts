import { query, pool } from './init';

async function run() {
    try {
        console.log('Adding location columns...');
        await query(`
      ALTER TABLE save_items 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
    `);
        console.log('✅ Location columns added successfully');
    } catch (error) {
        console.error('❌ Failed to add columns:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

run();
