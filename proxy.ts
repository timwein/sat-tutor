import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session gate (Next.js 16 "proxy", the successor to middleware.ts).
 * Refreshes the Supabase Auth session cookie on every request and sends
 * signed-out visitors to /login (pages) or returns 401 (API). Identity inside
 * pages and routes comes from lib/auth.ts, which re-reads the cookie; this
 * file only decides whether a request may proceed.
 */

const PUBLIC_PAGES = new Set(['/login', '/reset-password', '/auth/callback']);
const PUBLIC_API_PREFIXES = ['/api/auth/'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/pdf.worker.min.mjs'
  ) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the token with Supabase Auth (and refreshes it via
  // setAll above). Do not replace with getSession(): that trusts the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPath = isPublicPath(pathname);

  if (!user && !publicPath) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Please sign in.', code: 'unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search =
      pathname && pathname !== '/'
        ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
        : '';
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    const redirect = NextResponse.redirect(homeUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|pdf.worker.min.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
