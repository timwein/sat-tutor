import { NextResponse, type NextRequest } from 'next/server';
import { createAuthClient } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
