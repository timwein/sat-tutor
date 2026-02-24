import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;
    if (!token || !verifyAccessToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
