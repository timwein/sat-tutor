-- Add metadata column for practice test sessions
-- Stores: module_id, section, time_limit_seconds, etc.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
