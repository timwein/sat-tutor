import { NextRequest, NextResponse } from 'next/server';
import { getOrGenerateWeeklyGoals } from '@/lib/micro-goals';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: student_id' },
        { status: 400 }
      );
    }

    const goals = await getOrGenerateWeeklyGoals(studentId);

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Micro-goals GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
