-- ============================================
-- SAT Tutor Pro - Initial Schema
-- Migration: 00001_initial_schema
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. STUDENTS
-- ============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  parent_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 2. SKILL RATINGS (one row per sub-skill per student)
-- ============================================
CREATE TABLE skill_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sub_skill_id TEXT NOT NULL,
  elo_rating INTEGER DEFAULT 1000,
  questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  is_calibrated BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, sub_skill_id)
);

CREATE INDEX idx_skill_ratings_student ON skill_ratings(student_id);
CREATE INDEX idx_skill_ratings_sub_skill ON skill_ratings(sub_skill_id);

-- ============================================
-- 3. QUESTIONS BANK
-- ============================================
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('math', 'reading_writing')),
  sub_skill_id TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  question_text TEXT NOT NULL,
  passage_id TEXT,
  passage_text TEXT,
  answer_choices JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  distractor_analysis JSONB DEFAULT '{}'::jsonb,
  explanation TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_section ON questions(section);
CREATE INDEX idx_questions_sub_skill ON questions(sub_skill_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);

-- ============================================
-- 4. SESSIONS
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('quick_drill', 'study_session', 'timed_section', 'full_practice_test')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  accuracy FLOAT,
  summary TEXT,
  mood_signals JSONB DEFAULT '[]'::jsonb,
  sub_skills_practiced TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_sessions_student ON sessions(student_id);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);

-- ============================================
-- 5. QUESTION ATTEMPTS (core analytics table)
-- ============================================
CREATE TABLE question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(question_id),
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  confidence_level TEXT CHECK (confidence_level IN ('guessing', 'okay', 'confident')),
  error_type TEXT CHECK (error_type IN (
    'conceptual_gap', 'procedural_error', 'careless_rush',
    'misread_comprehension', 'trap_answer', 'time_pressure', 'knowledge_gap'
  )),
  distractor_type TEXT,
  error_explanation TEXT,
  explanation_strategy_used TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attempts_student ON question_attempts(student_id);
CREATE INDEX idx_attempts_session ON question_attempts(session_id);
CREATE INDEX idx_attempts_question ON question_attempts(question_id);
CREATE INDEX idx_attempts_error_type ON question_attempts(error_type);

-- ============================================
-- 6. REVIEW QUEUE (spaced repetition)
-- ============================================
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(question_id),
  next_review_date DATE NOT NULL,
  review_count INTEGER DEFAULT 0,
  last_review_result BOOLEAN,
  interval_days INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, question_id)
);

CREATE INDEX idx_review_student_date ON review_queue(student_id, next_review_date);

-- ============================================
-- 7. WRONG ANSWER INSIGHTS (Opus-generated)
-- ============================================
CREATE TABLE wrong_answer_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  total_wrong_answers_analyzed INTEGER,
  top_insights JSONB NOT NULL,
  dimension_details JSONB NOT NULL,
  raw_analysis TEXT
);

CREATE INDEX idx_insights_student ON wrong_answer_insights(student_id);
CREATE INDEX idx_insights_generated ON wrong_answer_insights(generated_at DESC);

-- ============================================
-- 8. SCORE PREDICTIONS
-- ============================================
CREATE TABLE score_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  total_score_low INTEGER,
  total_score_mid INTEGER,
  total_score_high INTEGER,
  rw_score INTEGER,
  math_score INTEGER,
  confidence FLOAT
);

CREATE INDEX idx_predictions_student ON score_predictions(student_id);

-- ============================================
-- 9. DAILY ACTIVITY (streak tracking)
-- ============================================
CREATE TABLE daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  streak_qualifying BOOLEAN DEFAULT FALSE,
  UNIQUE(student_id, activity_date)
);

CREATE INDEX idx_activity_student_date ON daily_activity(student_id, activity_date DESC);
