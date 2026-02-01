-- Migration: Add Performance Indexes
-- Created: 2026-02-01
-- Purpose: Optimize query performance for common operations

-- Use CONCURRENTLY to avoid locking tables during creation
-- Note: Run this when the database is not under heavy load

-- Main library query: user + status + created (for pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_user_status_created 
ON save_items(user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Folder view query: user + folder + created
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_user_folder_created 
ON save_items(user_id, folder_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Map view query: user + location (partial index for active items with locations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_user_location 
ON save_items(user_id, latitude, longitude) 
WHERE deleted_at IS NULL AND latitude IS NOT NULL;

-- URL duplicate check: user + source_url for quick duplicate detection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_user_url 
ON save_items(user_id, source_url) 
WHERE deleted_at IS NULL;

-- Soft delete query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_deleted_at 
ON save_items(user_id, deleted_at) 
WHERE deleted_at IS NOT NULL;

-- GIN index for array operations (topic filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_topics_gin 
ON save_items USING GIN(detected_topics) 
WHERE deleted_at IS NULL;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Performance indexes created successfully';
END $$;
