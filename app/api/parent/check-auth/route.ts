import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireApiStudent } from '@/lib/auth';
import { verifyAccessToken } from '@/lib/parent-auth';

export async function GET() {
  try {
    const auth = await requireApiStudent();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const result = verifyAccessToken(token);

    if (!result || result.studentId !== student.id) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      studentId: student.id,
    });
  } catch (error) {
    console.error('Check auth error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
