import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { SkillRating, QuestionAttempt, Question } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const subSkillId = searchParams.get('sub_skill_id');

    if (!studentId || !subSkillId) {
      return NextResponse.json(
        { error: 'Missing required query parameters: student_id, sub_skill_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Load skill rating
    const { data: ratingData } = await supabase
      .from('skill_ratings')
      .select('*')
      .eq('student_id', studentId)
      .eq('sub_skill_id', subSkillId)
      .maybeSingle();

    // Load recent attempts for this sub-skill
    // Join: get question_attempts where the question's sub_skill_id matches
    const { data: questionsForSkill } = await supabase
      .from('questions')
      .select('question_id')
      .eq('sub_skill_id', subSkillId);

    const questionIds = (questionsForSkill || []).map(
      (q: { question_id: string }) => q.question_id
    );

    let recentAttempts: Array<{
      attempt: QuestionAttempt;
      question: Question | null;
    }> = [];

    if (questionIds.length > 0) {
      const { data: attemptsData } = await supabase
        .from('question_attempts')
        .select('*')
        .eq('student_id', studentId)
        .in('question_id', questionIds)
        .order('attempted_at', { ascending: false })
        .limit(10);

      const attempts = (attemptsData || []) as QuestionAttempt[];

      // Load questions for these attempts
      const attemptQuestionIds = [
        ...new Set(attempts.map((a) => a.question_id)),
      ];
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .in('question_id', attemptQuestionIds);

      const questionsMap = new Map<string, Question>();
      for (const q of (questionsData || []) as Question[]) {
        questionsMap.set(q.question_id, q);
      }

      recentAttempts = attempts.map((a) => ({
        attempt: a,
        question: questionsMap.get(a.question_id) || null,
      }));
    }

    return NextResponse.json({
      rating: (ratingData as SkillRating | null) ?? null,
      recentAttempts,
    });
  } catch (error) {
    console.error('Skill detail GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
