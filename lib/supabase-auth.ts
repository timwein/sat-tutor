import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cookie-backed Supabase client for reading the signed-in user in Server
 * Components and Route Handlers. Uses the anon key, so it can only talk to
 * Supabase Auth: table access for the anon/authenticated roles is revoked
 * (migration 00005). Read application data with createServerClient().
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // The middleware refreshes sessions, so this is safe to ignore.
          }
        },
      },
    }
  );
}
