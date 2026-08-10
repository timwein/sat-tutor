-- ============================================
-- Add missing columns to sessions table
-- sub_skill_focus: tracks which skill a quick_drill targets
-- metadata: flexible JSONB for extra session config
-- ============================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sub_skill_focus TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
