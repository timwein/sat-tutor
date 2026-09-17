import { NextRequest, NextResponse } from 'next/server';
import { requireApiStudent } from '@/lib/auth';
import { getOrGenerateWeeklyGoals } from '@/lib/micro-goals';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const auth = await requireApiStudent(searchParams.get('student_id') ?? undefined);
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const goals = await getOrGenerateWeeklyGoals(student.id);

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Micro-goals GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
