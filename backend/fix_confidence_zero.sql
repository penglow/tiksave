-- Fix existing records: Set confidence to NULL where it's 0
-- This prevents showing 0% confidence bars in the UI
UPDATE save_items 
SET confidence = NULL 
WHERE confidence = 0;

