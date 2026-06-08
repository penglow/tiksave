/** CLI entry point to run database schema initialization migrations. */

// --- imports ---

import { initializeDatabase, pool } from './init.js';

// --- handlers ---

async function migrate() {
  try {
    console.log('Running database migrations...');
    await initializeDatabase();
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
