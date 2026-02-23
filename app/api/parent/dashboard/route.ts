import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import {
  getParentDashboardData,
  generateParentAlerts,
} from '@/lib/parent-dashboard';

export async function GET(request: NextRequest) {
  try {
    // Verify auth cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authResult = verifyAccessToken(token);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: student_id' },
        { status: 400 }
      );
    }

    // Verify the token matches the requested student
    if (authResult.studentId !== studentId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate alerts before fetching data
    await generateParentAlerts(studentId);

    // Fetch dashboard data
    const data = await getParentDashboardData(studentId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Parent dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
