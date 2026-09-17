import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireApiStudent } from '@/lib/auth';

/** Update the student's name and study preferences (stored in students.settings). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, rw_focus, default_mode, hide_from_leaderboard } = body;

    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const supabase = createServerClient();

    const updates: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim().length > 0) {
      updates.name = name.trim().slice(0, 80);
    }

    const settings = { ...((student.settings as Record<string, unknown>) ?? {}) };
    if (typeof rw_focus === 'boolean') settings.rw_focus = rw_focus;
    if (typeof hide_from_leaderboard === 'boolean') {
      settings.hide_from_leaderboard = hide_from_leaderboard;
    }
    if (default_mode === 'socratic' || default_mode === 'direct') {
      settings.default_mode = default_mode;
    }
    updates.settings = settings;

    const { error: updateError } = await supabase
      .from('students')
      .update(updates)
      .eq('id', student.id);

    if (updateError) {
      console.error('Settings update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
