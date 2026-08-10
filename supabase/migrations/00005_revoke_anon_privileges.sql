-- ============================================
-- SAT Tutor Pro - Revoke public API role privileges
-- Migration: 00005_revoke_anon_privileges
-- ============================================
-- All data access goes through Next.js API routes using the
-- service-role key. The anon/authenticated roles are never used
-- (createBrowserClient has no call sites), so revoke their table
-- privileges to close GraphQL schema discoverability and any
-- permissive INSERT policies. service_role is unaffected.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
