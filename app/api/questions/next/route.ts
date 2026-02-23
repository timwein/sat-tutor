import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { SESSION_CONFIGS, getSessionPhase, isSessionComplete } from '@/lib/session-manager';
import { detectFrustration } from '@/lib/frustration-detector';
import { selectNextQuestion } from '@/lib/question-selector';
import type {
  Session,
  QuestionAttempt,
  SkillRating,
  ReviewQueueItem,
  Question,
  SafeQuestion,
  AttemptSignal,
} from '@/lib/types';

function stripToSafeQuestion(q: Question): SafeQuestion {
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
    const { session_id, student_id } = body;

    if (!session_id || !student_id) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, student_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Load session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const typedSession = session as Session;

    if (typedSession.ended_at) {
      return NextResponse.json(
        { error: 'Session has already ended' },
        { status: 400 }
      );
    }

    if (typedSession.student_id !== student_id) {
      return NextResponse.json(
        { error: 'Session does not belong to this student' },
        { status: 403 }
      );
    }

    // Load all question_attempts for this session
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('session_id', session_id)
      .order('attempted_at', { ascending: true });

    if (attemptsError) {
      console.error('Failed to load attempts:', attemptsError);
      return NextResponse.json(
        { error: 'Failed to load session attempts' },
        { status: 500 }
      );
    }

    const typedAttempts = (attempts || []) as QuestionAttempt[];

    // Load student skill_ratings
    const { data: skillRatings, error: ratingsError } = await supabase
      .from('skill_ratings')
      .select('*')
      .eq('student_id', student_id);

    if (ratingsError) {
      console.error('Failed to load skill ratings:', ratingsError);
      return NextResponse.json(
        { error: 'Failed to load skill ratings' },
        { status: 500 }
      );
    }

    const typedRatings = (skillRatings || []) as SkillRating[];

    // Load review_queue items due today or earlier
    const today = new Date().toISOString().split('T')[0];
    const { data: reviewItems, error: reviewError } = await supabase
      .from('review_queue')
      .select('*')
      .eq('student_id', student_id)
      .lte('next_review_date', today);

    if (reviewError) {
      console.error('Failed to load review queue:', reviewError);
      return NextResponse.json(
        { error: 'Failed to load review queue' },
        { status: 500 }
      );
    }

    const typedReviewItems = (reviewItems || []) as ReviewQueueItem[];

    // Calculate elapsed minutes
    const startedAt = new Date(typedSession.started_at);
    const elapsedMs = Date.now() - startedAt.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    // Get session config and phase
    const config = SESSION_CONFIGS[typedSession.session_type];
    const sessionPhase = getSessionPhase(elapsedMinutes, config.durationMinutes);

    // Run frustration detection
    const attemptSignals: AttemptSignal[] = typedAttempts.map((a) => ({
      isCorrect: a.is_correct,
      timeSpentSeconds: a.time_spent_seconds,
      wasSkipped: a.student_answer === 'SKIP',
    }));
    const frustrationState = detectFrustration(attemptSignals);

    // Check if session is complete
    if (isSessionComplete(typedSession.questions_answered, elapsedMinutes, config)) {
      return NextResponse.json({
        question: null,
        selection_metadata: null,
        session_ended: true,
      });
    }

    // Load all questions from DB
    const { data: allQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*');

    if (questionsError) {
      console.error('Failed to load questions:', questionsError);
      return NextResponse.json(
        { error: 'Failed to load questions' },
        { status: 500 }
      );
    }

    const typedQuestions = (allQuestions || []) as Question[];

    // Filter out already-attempted questions
    const attemptedQuestionIds = new Set(typedAttempts.map((a) => a.question_id));
    const availableQuestions = typedQuestions.filter(
      (q) => !attemptedQuestionIds.has(q.question_id)
    );

    if (availableQuestions.length === 0) {
      return NextResponse.json({
        question: null,
        selection_metadata: { reason: 'No more questions available' },
        session_ended: true,
      });
    }

    // Run question selection
    const selectionResult = selectNextQuestion({
      skillRatings: typedRatings,
      reviewQueue: typedReviewItems,
      availableQuestions,
      sessionPhase,
      isFrustrated: frustrationState.isFrustrated,
      subSkillFocus: (session as Record<string, unknown>).sub_skill_focus as string | undefined,
    });

    if (!selectionResult) {
      return NextResponse.json({
        question: null,
        selection_metadata: { reason: 'Could not select a question' },
        session_ended: true,
      });
    }

    // Strip sensitive fields for the client
    const safeQuestion = stripToSafeQuestion(selectionResult.question);

    return NextResponse.json({
      question: safeQuestion,
      selection_metadata: {
        category: selectionResult.category,
        target_sub_skill: selectionResult.targetSubSkill,
        target_difficulty: selectionResult.targetDifficulty,
        reason: selectionResult.reason,
        session_phase: sessionPhase,
        frustration_state: frustrationState,
      },
      session_ended: false,
    });
  } catch (error) {
    console.error('Next question error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
