import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import { createServerClient } from '@/lib/supabase';
import { generateQuestionId } from '@/lib/pdf-question-parser';
import type { ClassifiedQuestion } from '@/lib/pdf-question-parser';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Verify auth cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authResult = verifyAccessToken(token);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { questions, testLabel } = body as {
      questions: ClassifiedQuestion[];
      testLabel: string;
    };

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions to insert' },
        { status: 400 }
      );
    }

    if (!testLabel) {
      return NextResponse.json(
        { error: 'Missing testLabel' },
        { status: 400 }
      );
    }

    // Map classified questions to database rows
    const rows = questions.map((q) => ({
      question_id: generateQuestionId(testLabel, q.module, q.questionNumber),
      source: 'college_board',
      section: q.section,
      sub_skill_id: q.subSkillId,
      difficulty: q.difficulty,
      question_text: q.questionText,
      passage_id: null,
      passage_text: q.passageText,
      answer_choices: q.answerChoices,
      correct_answer: q.correctAnswer,
      distractor_analysis: q.distractorAnalysis,
      explanation: q.explanation,
      is_ai_generated: false,
      tags: [`college_board`, testLabel.toLowerCase().replace(/\s+/g, '_')],
    }));

    const supabase = createServerClient();

    const { error: upsertError, count } = await supabase
      .from('questions')
      .upsert(rows, { onConflict: 'question_id', count: 'exact' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to insert questions: ' + upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inserted: count ?? rows.length,
      message: `Successfully imported ${count ?? rows.length} questions`,
    });
  } catch (error) {
    console.error('Confirm upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
