import { NextRequest, NextResponse } from 'next/server';

/**
 * Optional front-door protection: when APP_PASSWORD is set, every page
 * requires a one-time unlock (30-day cookie). Leave APP_PASSWORD unset to
 * keep the app open. Keeps strangers who find the URL from using the app
 * (and spending Claude credits) without building real auth.
 */

async function expectedCookieValue(): Promise<string> {
  const secret = `${process.env.APP_PASSWORD}:${process.env.PARENT_ACCESS_SECRET ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (
    pathname === '/unlock' ||
    pathname === '/api/unlock' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('app_access')?.value;
  if (cookie && cookie === (await expectedCookieValue())) {
    return NextResponse.next();
  }

  const unlockUrl = request.nextUrl.clone();
  unlockUrl.pathname = '/unlock';
  unlockUrl.search = '';
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Locked' }, { status: 401 });
  }
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
