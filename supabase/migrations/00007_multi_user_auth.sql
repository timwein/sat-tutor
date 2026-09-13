-- ============================================
-- SAT Tutor Pro - Multi-user accounts
-- Migration: 00007_multi_user_auth
-- ============================================
-- Links each students row to a Supabase Auth user, adds an admin flag,
-- and stores each student's own (encrypted) Anthropic API key so every
-- account pays for its own AI usage. Data access still goes through the
-- service-role key in API routes; the anon/authenticated roles stay
-- revoked (migration 00005). Supabase Auth is used only for identity.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- AES-256-GCM ciphertext produced by lib/crypto.ts; never sent to the client.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS anthropic_key_ciphertext TEXT;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS anthropic_key_last4 TEXT;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS anthropic_key_added_at TIMESTAMPTZ;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_students_auth_user ON students(auth_user_id);

-- Linking an existing (pre-auth) student row to a login: set the row's
-- email to the address the student signs up with. On first login the app
-- claims the unlinked row whose email matches, so no data is lost.
--   UPDATE students SET email = 'student@example.com' WHERE id = '<existing row id>';
