import { query, pool } from './init';

async function run() {
  try {
    console.log('Adding save_item_locations table...');

    await query(`
      CREATE TABLE IF NOT EXISTS save_item_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES save_items(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        location_name VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_save_item_locations_item_id ON save_item_locations(item_id);
    `);

    console.log('✅ save_item_locations table ready');
  } catch (error) {
    console.error('❌ Failed to create save_item_locations:', error);
  } finally {
    await pool.end();
    process.exit();
  }
}

run();

