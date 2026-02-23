-- ============================================
-- SAT Tutor Pro - Missing Tables
-- Migration: 00002_missing_tables
-- Adds: micro_goals, parent_alerts, parent_access
-- ============================================

-- ============================================
-- 10. MICRO GOALS (weekly goals)
-- ============================================
CREATE TABLE IF NOT EXISTS micro_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('master_skills', 'complete_drills', 'reduce_errors', 'accuracy_target', 'study_streak', 'review_queue')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_micro_goals_student_week ON micro_goals(student_id, week_start);

-- ============================================
-- 11. PARENT ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS parent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('study_gap', 'skill_regression', 'milestone')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_parent_alerts_student ON parent_alerts(student_id, is_read, created_at DESC);

-- ============================================
-- 12. PARENT ACCESS (PIN auth)
-- ============================================
CREATE TABLE IF NOT EXISTS parent_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);
