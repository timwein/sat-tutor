'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client for auth flows only (sign in, sign up, sign out,
 * password reset). It stores the session in cookies that the middleware and
 * server helpers read. It cannot query tables: the anon role has no table
 * privileges (migration 00005). All data goes through /api routes.
 */
export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
