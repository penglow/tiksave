-- Migration: Add processing stage tracking columns
-- Created: 2026-02-01
-- Purpose: Track real-time progress of video processing

-- Add processing stage columns
ALTER TABLE save_items 
ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(50) DEFAULT 'queued',
ADD COLUMN IF NOT EXISTS processing_progress INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_message TEXT;

-- Create index for querying items by processing stage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_save_items_processing 
ON save_items(user_id, processing_stage, processing_progress) 
WHERE status IN ('queued', 'processing');

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Processing stage columns added successfully';
END $$;
