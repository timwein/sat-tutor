import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireApiStudent } from '@/lib/auth';
import { requireParentAccess } from '@/lib/parent-auth';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_id } = body;

    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const parentDenied = await requireParentAccess(student.id);
    if (parentDenied) return parentDenied;

    if (!alert_id) {
      return NextResponse.json(
        { error: 'Missing required field: alert_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from('parent_alerts')
      .update({ is_read: true })
      .eq('id', alert_id)
      .eq('student_id', student.id);

    if (error) {
      console.error('Failed to mark alert as read:', error);
      return NextResponse.json(
        { error: 'Failed to update alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alert PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
