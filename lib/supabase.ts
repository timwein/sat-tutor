import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client (uses service role key, bypasses RLS).
// ONLY use in API routes, Server Components and Server Actions - never in
// client components. Identity comes from lib/auth.ts, not from this client.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// For the cookie-based auth clients see lib/supabase-auth.ts (server) and
// lib/supabase-browser.ts (client components).
