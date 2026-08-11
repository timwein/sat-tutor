import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** Update the student's name and study preferences (stored in students.settings). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, name, rw_focus, default_mode } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: student, error: loadError } = await supabase
      .from('students')
      .select('id, settings')
      .eq('id', student_id)
      .single();

    if (loadError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim().length > 0) {
      updates.name = name.trim().slice(0, 80);
    }

    const settings = { ...((student.settings as Record<string, unknown>) ?? {}) };
    if (typeof rw_focus === 'boolean') settings.rw_focus = rw_focus;
    if (default_mode === 'socratic' || default_mode === 'direct') {
      settings.default_mode = default_mode;
    }
    updates.settings = settings;

    const { error: updateError } = await supabase
      .from('students')
      .update(updates)
      .eq('id', student_id);

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
