import { NextRequest, NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { requireParentAccess } from '@/lib/parent-auth';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const parentDenied = await requireParentAccess(student.id);
    if (parentDenied) return parentDenied;

    const { questionId, correctAnswer } = (await request.json()) as {
      questionId: string;
      correctAnswer: string;
    };

    if (!questionId || !correctAnswer) {
      return NextResponse.json({ error: 'Missing questionId or correctAnswer' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('questions')
      .update({ correct_answer: correctAnswer })
      .eq('question_id', questionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
