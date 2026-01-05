-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create initial schema (backup of the main schema from backend)
-- This runs when the database is first created

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Folders table
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
);

-- Save items table
CREATE TABLE IF NOT EXISTS save_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    raw_shared_text TEXT,
    status VARCHAR(50) DEFAULT 'queued',
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Training examples table
CREATE TABLE IF NOT EXISTS training_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES save_items(id) ON DELETE CASCADE,
    original_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    corrected_folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    features JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    weights JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, folder_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_save_items_user_id ON save_items(user_id);
CREATE INDEX IF NOT EXISTS idx_save_items_folder_id ON save_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_save_items_status ON save_items(status);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_training_examples_user_id ON training_examples(user_id);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_save_items_fts ON save_items 
USING gin(to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(transcript_text, '') || ' ' || 
    COALESCE(raw_shared_text, '')
));

