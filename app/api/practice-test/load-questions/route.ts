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
    const { student_id, session_id, section, question_count, difficulty_bias } = body as {
      student_id: string;
      session_id: string;
      section: string;
      question_count: number;
      /** Adaptive module 2: bias selection by module-1 performance */
      difficulty_bias?: 'harder' | 'easier';
    };

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

    // Exclude questions already used earlier in this session (a full test's
    // module 2 must not repeat module 1's questions).
    const { data: usedAttempts } = await supabase
      .from('question_attempts')
      .select('question_id')
      .eq('session_id', session_id);
    const usedIds = new Set((usedAttempts ?? []).map((a) => a.question_id));

    const typedQuestions = (allQuestions as Question[]).filter(
      (q) => !usedIds.has(q.question_id)
    );

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

    // Pick questions across difficulties - proportionally by default, or
    // biased toward harder/easier questions for the adaptive second module.
    const effectiveCount = Math.min(question_count, typedQuestions.length);
    const selected: Question[] = [];
    const difficulties = Object.keys(byDifficulty).map(Number).sort();

    if (difficulties.length > 0 && difficulty_bias) {
      // Difficulty weights: harder modules lean 4-5, easier lean 1-2.
      const weightFor = (d: number) =>
        difficulty_bias === 'harder'
          ? [0.05, 0.1, 0.2, 0.35, 0.3][d - 1] ?? 0.2
          : [0.3, 0.35, 0.2, 0.1, 0.05][d - 1] ?? 0.2;
      const targets = difficulties.map((d) => ({
        d,
        want: Math.round(effectiveCount * weightFor(d)),
      }));
      for (const t of targets) {
        selected.push(...byDifficulty[t.d].slice(0, t.want));
      }
      // Fill any shortfall from whatever remains, biased order
      if (selected.length < effectiveCount) {
        const chosen = new Set(selected.map((q) => q.question_id));
        const rest = typedQuestions
          .filter((q) => !chosen.has(q.question_id))
          .sort((a, b) =>
            difficulty_bias === 'harder'
              ? b.difficulty - a.difficulty
              : a.difficulty - b.difficulty
          );
        selected.push(...rest.slice(0, effectiveCount - selected.length));
      }
      selected.splice(effectiveCount);
    } else if (difficulties.length > 0) {
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
