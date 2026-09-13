import { NextRequest, NextResponse } from 'next/server';
import { requireApiStudent } from '@/lib/auth';
import { requireParentAccess } from '@/lib/parent-auth';
import {
  getParentDashboardData,
  generateParentAlerts,
} from '@/lib/parent-dashboard';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await requireApiStudent(searchParams.get('student_id'));
    if (!auth.ok) return auth.response;
    const { student } = auth;
    const studentId = student.id;

    // The parent PIN token must belong to the signed-in student
    const parentDenied = await requireParentAccess(studentId);
    if (parentDenied) return parentDenied;

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
