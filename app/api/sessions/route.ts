import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Session } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, session_type, sub_skill_focus } = body;

    if (!student_id || !session_type) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, session_type' },
        { status: 400 }
      );
    }

    const validTypes = ['quick_drill', 'study_session', 'timed_section', 'full_practice_test'];
    if (!validTypes.includes(session_type)) {
      return NextResponse.json(
        { error: `session_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { metadata } = body;

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        student_id,
        session_type,
        started_at: new Date().toISOString(),
        questions_answered: 0,
        questions_correct: 0,
        accuracy: null,
        summary: null,
        mood_signals: [],
        sub_skills_practiced: [],
        ...(sub_skill_focus ? { sub_skill_focus } : {}),
        ...(metadata ? { metadata } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error('Session creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ session: data as Session });
  } catch (error) {
    console.error('Session POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: student_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Session list error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json(data as Session[]);
  } catch (error) {
    console.error('Session GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
