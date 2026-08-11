import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function expectedCookieValue(): Promise<string> {
  const secret = `${process.env.APP_PASSWORD}:${process.env.PARENT_ACCESS_SECRET ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ success: true, note: 'App is not locked' });
  }

  const { password } = await request.json();
  if (typeof password !== 'string' || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  (await cookies()).set('app_access', await expectedCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
