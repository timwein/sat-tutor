import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const result = verifyAccessToken(token);

    if (!result) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      studentId: result.studentId,
    });
  } catch (error) {
    console.error('Check auth error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
