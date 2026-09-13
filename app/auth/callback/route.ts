import { NextResponse, type NextRequest } from 'next/server';
import { createAuthClient } from '@/lib/supabase-auth';

/**
 * Supabase Auth redirect target (password-recovery links, and email
 * confirmation if it is ever enabled). Exchanges the one-time code for a
 * session cookie, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/';
  // Only allow same-origin relative paths.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('Auth code exchange failed:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
