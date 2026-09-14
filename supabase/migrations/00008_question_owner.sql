-- ============================================
-- SAT Tutor Pro - Question ownership
-- Migration: 00008_question_owner
-- ============================================
-- Word-bank drills are generated from a student's private banked words
-- with that student's own Anthropic key, so they must not be served to
-- other students. Rows with a NULL owner are the shared bank (admin
-- managed, plus generic grammar-rule drills). Question selection filters
-- to owner IS NULL OR owner = the signed-in student.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS created_by_student_id UUID REFERENCES students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_owner ON questions(created_by_student_id);
