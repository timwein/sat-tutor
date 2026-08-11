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
    is_ai_generated: q.is_ai_generated,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, student_id, prefer_strength } = body;

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

    // Record frustration signals on the session (non-fatal if it fails)
    if (frustrationState.isFrustrated) {
      const existingSignals = Array.isArray(typedSession.mood_signals)
        ? typedSession.mood_signals
        : [];
      const entry = {
        at: new Date().toISOString(),
        consecutive_wrong: frustrationState.consecutiveWrong,
        signals: frustrationState.signals,
        recommendation: frustrationState.recommendation,
      };
      await supabase
        .from('sessions')
        .update({ mood_signals: [...existingSignals.slice(-19), entry] })
        .eq('id', session_id);
    }

    // Check if session is complete
    if (isSessionComplete(typedSession.questions_answered, elapsedMinutes, config)) {
      return NextResponse.json({
        question: null,
        selection_metadata: null,
        session_ended: true,
      });
    }

    const attemptedQuestionIds = new Set(typedAttempts.map((a) => a.question_id));

    // Review-mode session: serve the exact questions that are due for review,
    // oldest due first. The session ends when the due list is exhausted.
    const sessionMetadata =
      ((session as Record<string, unknown>).metadata as Record<string, unknown> | null) ?? {};
    if (sessionMetadata.review === true) {
      const dueUnattempted = [...typedReviewItems]
        .sort((a, b) => a.next_review_date.localeCompare(b.next_review_date))
        .filter((item) => !attemptedQuestionIds.has(item.question_id));

      if (dueUnattempted.length === 0) {
        return NextResponse.json({
          question: null,
          selection_metadata: { reason: 'Review queue cleared - nice work!' },
          session_ended: true,
        });
      }

      const target = dueUnattempted[0];
      const { data: reviewQuestion } = await supabase
        .from('questions')
        .select('*')
        .eq('question_id', target.question_id)
        .single();

      if (!reviewQuestion) {
        return NextResponse.json({
          question: null,
          selection_metadata: { reason: 'Review question missing from bank' },
          session_ended: true,
        });
      }

      return NextResponse.json({
        question: stripToSafeQuestion(reviewQuestion as Question),
        selection_metadata: {
          category: 'spaced_repetition',
          target_sub_skill: (reviewQuestion as Question).sub_skill_id,
          target_difficulty: (reviewQuestion as Question).difficulty,
          reason: `Review #${target.review_count + 1}, due ${target.next_review_date}`,
          session_phase: sessionPhase,
          frustration_state: frustrationState,
          remaining_reviews: dueUnattempted.length - 1,
        },
        session_ended: false,
      });
    }

    // Load a lightweight view of the bank for selection (no passages), then
    // fetch the chosen question in full. Keeps payloads small as the bank grows.
    let subSkillFocus = (session as Record<string, unknown>).sub_skill_focus as
      | string
      | undefined;

    // "Switch to easier questions": serve from the student's strongest
    // calibrated skill for a few questions to rebuild confidence.
    if (prefer_strength === true && typedRatings.length > 0) {
      const strongest = [...typedRatings]
        .filter((r) => r.is_calibrated)
        .sort((a, b) => b.elo_rating - a.elo_rating)[0];
      if (strongest) subSkillFocus = strongest.sub_skill_id;
    }

    // Reading & Writing focus preference: bias mixed study sessions toward
    // RW questions (~3 in 4) when the student has it enabled in Settings.
    let sectionFocus: 'math' | 'reading_writing' | null = null;
    if (!subSkillFocus && typedSession.session_type === 'study_session') {
      const { data: studentRow } = await supabase
        .from('students')
        .select('settings')
        .eq('id', student_id)
        .single();
      const settings = (studentRow?.settings as Record<string, unknown> | null) ?? {};
      if (settings.rw_focus === true && Math.random() < 0.75) {
        sectionFocus = 'reading_writing';
      }
    }

    let lightQuery = supabase
      .from('questions')
      .select('id, question_id, sub_skill_id, difficulty, section');
    if (subSkillFocus) {
      lightQuery = lightQuery.eq('sub_skill_id', subSkillFocus);
    }
    if (sectionFocus) {
      lightQuery = lightQuery.eq('section', sectionFocus);
    }
    const { data: lightQuestions, error: questionsError } = await lightQuery;

    if (questionsError) {
      console.error('Failed to load questions:', questionsError);
      return NextResponse.json(
        { error: 'Failed to load questions' },
        { status: 500 }
      );
    }

    const typedQuestions = (lightQuestions || []) as Question[];

    // Filter out already-attempted questions
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
      subSkillFocus,
      sectionFocus,
    });

    if (!selectionResult) {
      return NextResponse.json({
        question: null,
        selection_metadata: { reason: 'Could not select a question' },
        session_ended: true,
      });
    }

    // Fetch the chosen question in full (passage, choices, etc.)
    const { data: fullQuestion, error: fullError } = await supabase
      .from('questions')
      .select('*')
      .eq('question_id', selectionResult.question.question_id)
      .single();

    if (fullError || !fullQuestion) {
      console.error('Failed to load selected question:', fullError);
      return NextResponse.json(
        { error: 'Failed to load selected question' },
        { status: 500 }
      );
    }

    // Strip sensitive fields for the client
    const safeQuestion = stripToSafeQuestion(fullQuestion as Question);

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
