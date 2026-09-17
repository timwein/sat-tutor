import { NextRequest, NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { requireParentAccess } from '@/lib/parent-auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const parentDenied = await requireParentAccess(student.id);
    if (parentDenied) return parentDenied;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('questions')
      .select('question_id, correct_answer, tags')
      .eq('source', 'college_board')
      .order('question_id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ questions: data });
  } catch (error) {
    console.error('Fetch questions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
