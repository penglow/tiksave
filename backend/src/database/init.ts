import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Enable pgvector extension for embeddings
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Folders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
        icon_name VARCHAR(50),
        color_hex VARCHAR(7),
        sort_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT FALSE,
        rules JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name, parent_id)
      )
    `);

    // Save items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS save_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_url TEXT NOT NULL,
        raw_shared_text TEXT,
        status VARCHAR(50) DEFAULT 'queued',
        video_blob_name TEXT,
        thumbnail_url TEXT,
        transcript_text TEXT,
        detected_topics TEXT[],
        detected_labels TEXT[],
        predicted_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
        confidence DECIMAL(3,2),
        folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
        title VARCHAR(500),
        duration DECIMAL(10,2),
        creator_name VARCHAR(255),
        creator_username VARCHAR(255),
        video_indexer_id VARCHAR(255),
        insights_json JSONB,
        error_message TEXT,
        embedding vector(1536),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        location_name VARCHAR(255),
        address TEXT,
        deleted_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add deleted_at column if it doesn't exist (migration for existing databases)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE save_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END $$;
    `);

    // Save item locations table (supports multiple locations per item)
    await client.query(`
      CREATE TABLE IF NOT EXISTS save_item_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES save_items(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        location_name VARCHAR(255),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Training examples table (for learning from user corrections)
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_examples (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID NOT NULL REFERENCES save_items(id) ON DELETE CASCADE,
        original_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
        corrected_folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        features JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User preferences (learned weights)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        weights JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, folder_id)
      )
    `);

    // Refresh tokens (rotation + revocation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        replaced_by_token_hash VARCHAR(128),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_save_items_user_id ON save_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_save_items_folder_id ON save_items(folder_id);
      CREATE INDEX IF NOT EXISTS idx_save_items_status ON save_items(status);
      CREATE INDEX IF NOT EXISTS idx_save_items_created_at ON save_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_training_examples_user_id ON training_examples(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_root_unique
      ON folders(user_id, name)
      WHERE parent_id IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_save_item_locations_item_id ON save_item_locations(item_id);
    `);

    // Create vector similarity index (for semantic search)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_save_items_embedding 
      ON save_items 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `).catch(() => {
      // Index creation might fail if not enough rows, that's ok
      console.log('Note: Vector index will be created when data is available');
    });

    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

// Query helper
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Query:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
  }
  
  return result;
}

