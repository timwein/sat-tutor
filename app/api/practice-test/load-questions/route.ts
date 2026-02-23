import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { Question, SafeQuestion } from '@/lib/types';

function stripToSafe(q: Question): SafeQuestion {
  return {
    id: q.id,
    question_id: q.question_id,
    section: q.section,
    sub_skill_id: q.sub_skill_id,
    difficulty: q.difficulty,
    question_text: q.question_text,
    passage_text: q.passage_text,
    answer_choices: q.answer_choices,
    tags: q.tags,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, session_id, section, question_count } = body;

    if (!student_id || !session_id || !section || !question_count) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, session_id, section, question_count' },
        { status: 400 }
      );
    }

    if (!['math', 'reading_writing'].includes(section)) {
      return NextResponse.json(
        { error: 'section must be "math" or "reading_writing"' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify session belongs to student
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('student_id')
      .eq('id', session_id)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (sessionData.student_id !== student_id) {
      return NextResponse.json(
        { error: 'Session does not belong to this student' },
        { status: 403 }
      );
    }

    // Load all questions for this section, with difficulty spread
    // We want a mix of difficulties, not adaptive selection
    const { data: allQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('section', section)
      .order('difficulty', { ascending: true });

    if (questionsError || !allQuestions) {
      return NextResponse.json(
        { error: 'Failed to load questions' },
        { status: 500 }
      );
    }

    const typedQuestions = allQuestions as Question[];

    // Select questions with difficulty spread
    // Group by difficulty, then pick proportionally
    const byDifficulty: Record<number, Question[]> = {};
    for (const q of typedQuestions) {
      const d = q.difficulty;
      if (!byDifficulty[d]) byDifficulty[d] = [];
      byDifficulty[d].push(q);
    }

    // Shuffle within each difficulty group
    for (const group of Object.values(byDifficulty)) {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }

    // Pick questions proportionally across difficulties
    const effectiveCount = Math.min(question_count, typedQuestions.length);
    const selected: Question[] = [];
    const difficulties = Object.keys(byDifficulty).map(Number).sort();

    if (difficulties.length > 0) {
      const perDifficulty = Math.floor(effectiveCount / difficulties.length);
      const remainder = effectiveCount % difficulties.length;

      for (let i = 0; i < difficulties.length; i++) {
        const d = difficulties[i];
        const take = perDifficulty + (i < remainder ? 1 : 0);
        selected.push(...byDifficulty[d].slice(0, take));
      }
    }

    // Shuffle the final selection so difficulty isn't in order
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    const safeQuestions = selected.map(stripToSafe);

    return NextResponse.json({
      questions: safeQuestions,
      effective_count: safeQuestions.length,
      requested_count: question_count,
    });
  } catch (error) {
    console.error('Load questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
