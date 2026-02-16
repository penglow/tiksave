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
    processing_stage VARCHAR(50) DEFAULT 'queued', -- Added 2026-02-01
    processing_progress INT DEFAULT 0, -- Added 2026-02-01
    processing_message TEXT, -- Added 2026-02-01
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

-- Refresh token tracking table (rotation + revocation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    replaced_by_token_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Save item locations table (supports multiple locations per item)
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_save_items_user_id ON save_items(user_id);
CREATE INDEX IF NOT EXISTS idx_save_items_folder_id ON save_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_save_items_status ON save_items(status);
CREATE INDEX IF NOT EXISTS idx_save_items_created_at ON save_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_training_examples_user_id ON training_examples(user_id);
CREATE INDEX IF NOT EXISTS idx_save_item_locations_item_id ON save_item_locations(item_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_root_unique ON folders(user_id, name) WHERE parent_id IS NULL;

-- Performance optimized composite indexes (added 2026-02-01)
-- Main library query: user + status + created (for pagination)
CREATE INDEX IF NOT EXISTS idx_save_items_user_status_created 
ON save_items(user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Folder view query: user + folder + created
CREATE INDEX IF NOT EXISTS idx_save_items_user_folder_created 
ON save_items(user_id, folder_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Map view query: user + location (partial index for active items with locations)
CREATE INDEX IF NOT EXISTS idx_save_items_user_location 
ON save_items(user_id, latitude, longitude) 
WHERE deleted_at IS NULL AND latitude IS NOT NULL;

-- URL duplicate check: user + source_url for quick duplicate detection
CREATE INDEX IF NOT EXISTS idx_save_items_user_url 
ON save_items(user_id, source_url) 
WHERE deleted_at IS NULL;

-- Soft delete query optimization
CREATE INDEX IF NOT EXISTS idx_save_items_deleted_at 
ON save_items(user_id, deleted_at) 
WHERE deleted_at IS NOT NULL;

-- GIN index for array operations (topic filtering)
CREATE INDEX IF NOT EXISTS idx_save_items_topics_gin 
ON save_items USING GIN(detected_topics) 
WHERE deleted_at IS NULL;

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_save_items_fts ON save_items 
USING gin(to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(transcript_text, '') || ' ' || 
    COALESCE(raw_shared_text, '')
));
