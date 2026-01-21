import { query, pool } from './init';

async function run() {
    try {
        console.log('Adding address column...');
        await query(`
      ALTER TABLE save_items 
      ADD COLUMN IF NOT EXISTS address TEXT;
    `);
        console.log('✅ Address column added successfully');
    } catch (error) {
        console.error('❌ Failed to add column:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

run();
