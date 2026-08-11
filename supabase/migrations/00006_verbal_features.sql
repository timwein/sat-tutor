-- Verbal score builders: personal word bank, strategy experiments,
-- and attempt metadata (gym classification step, experiment arms).

-- ============================================
-- WORD BANK (personal vocabulary)
-- ============================================
CREATE TABLE IF NOT EXISTS word_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  context_sentence TEXT,
  source_question_id TEXT,
  source_label TEXT,
  definition TEXT,
  connotation TEXT CHECK (connotation IN ('positive', 'negative', 'neutral')),
  part_of_speech TEXT,
  usage_example TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'mastered', 'archived')),
  from_miss BOOLEAN NOT NULL DEFAULT FALSE,
  times_drilled INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  drills_generated BOOLEAN NOT NULL DEFAULT FALSE,
  drills_generated_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, normalized_word)
);

CREATE INDEX IF NOT EXISTS idx_word_bank_student ON word_bank(student_id, status, added_at DESC);

-- ============================================
-- STRATEGY EXPERIMENTS (reading protocol A/B)
-- ============================================
CREATE TABLE IF NOT EXISTS strategy_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  experiment_type TEXT NOT NULL DEFAULT 'reading_protocol',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'concluded')),
  arms JSONB NOT NULL DEFAULT '{}'::jsonb,
  conclusion JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_strategy_experiments_student ON strategy_experiments(student_id, status);

-- ============================================
-- ATTEMPT METADATA (gym step-1 result, experiment arm)
-- ============================================
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Server-only access, same posture as every other table (migration 00005).
REVOKE ALL ON word_bank FROM anon, authenticated;
REVOKE ALL ON strategy_experiments FROM anon, authenticated;
