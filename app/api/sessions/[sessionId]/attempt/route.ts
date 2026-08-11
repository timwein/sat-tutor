import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { calculateEloAdjustment, getMasteryLevel } from '@/lib/elo';

import { detectFrustration } from '@/lib/frustration-detector';
import { getNextInterval, getNextReviewDate } from '@/lib/spaced-repetition';
import type {
  Question,
  Session,
  SkillRating,
  QuestionAttempt,
  ReviewQueueItem,
  AttemptResponse,
  AttemptSignal,

} from '@/lib/types';
import { SKILL_TAXONOMY } from '@/lib/types';

const VALID_ERROR_TYPES = new Set([
  'conceptual_gap', 'procedural_error', 'careless_rush',
  'misread_comprehension', 'trap_answer', 'time_pressure', 'knowledge_gap',
]);

function sanitizeErrorType(errorType: string | undefined | null): string | null {
  if (!errorType) return null;
  return VALID_ERROR_TYPES.has(errorType) ? errorType : null;
}

function lookupSubSkillName(subSkillId: string): string {
  const allSkills = [
    ...SKILL_TAXONOMY.reading_writing,
    ...SKILL_TAXONOMY.math,
  ];
  const found = allSkills.find((s) => s.id === subSkillId);
  return found ? found.name : subSkillId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const {
      student_id,
      question_id,
      student_answer,
      time_spent_seconds,
      confidence_level,
      skipped,
      metadata,
    } = body;

    // Validate required fields
    if (!student_id || !question_id || (!student_answer && !skipped)) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, question_id, student_answer (or skipped)' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Load the full question by question_id field (NOT the UUID id)
    const { data: questionData, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('question_id', question_id)
      .single();

    if (questionError || !questionData) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    const question = questionData as Question;

    // Load session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessionData as Session;

    if (session.student_id !== student_id) {
      return NextResponse.json(
        { error: 'Session does not belong to this student' },
        { status: 403 }
      );
    }

    if (session.ended_at) {
      return NextResponse.json(
        { error: 'Session has already ended' },
        { status: 400 }
      );
    }

    // Determine correctness
    const effectiveAnswer = skipped ? 'SKIP' : student_answer;
    const isCorrect = !skipped && student_answer.toUpperCase() === question.correct_answer.toUpperCase();

    // ----- Elo Update -----
    // Load or create skill_rating for this student + sub_skill
    const { data: existingRating } = await supabase
      .from('skill_ratings')
      .select('*')
      .eq('student_id', student_id)
      .eq('sub_skill_id', question.sub_skill_id)
      .single();

    let currentRating = existingRating as SkillRating | null;

    if (!currentRating) {
      // Create a new skill_rating row with defaults
      const { data: newRating, error: insertError } = await supabase
        .from('skill_ratings')
        .insert({
          student_id,
          sub_skill_id: question.sub_skill_id,
          elo_rating: 1000,
          questions_attempted: 0,
          questions_correct: 0,
          is_calibrated: false,
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError || !newRating) {
        console.error('Failed to create skill rating:', insertError);
        return NextResponse.json(
          { error: 'Failed to create skill rating' },
          { status: 500 }
        );
      }

      currentRating = newRating as SkillRating;
    }

    const previousElo = currentRating.elo_rating;
    const eloResult = calculateEloAdjustment({
      currentElo: previousElo,
      questionDifficulty: question.difficulty,
      isCorrect,
      questionsAttempted: currentRating.questions_attempted,
    });

    const newQuestionsAttempted = currentRating.questions_attempted + 1;
    const newQuestionsCorrect = currentRating.questions_correct + (isCorrect ? 1 : 0);

    // Update skill_rating
    const { error: updateRatingError } = await supabase
      .from('skill_ratings')
      .update({
        elo_rating: eloResult.newElo,
        questions_attempted: newQuestionsAttempted,
        questions_correct: newQuestionsCorrect,
        is_calibrated: newQuestionsAttempted >= 5,
        last_updated: new Date().toISOString(),
      })
      .eq('id', currentRating.id);

    if (updateRatingError) {
      console.error('Failed to update skill rating:', updateRatingError);
      return NextResponse.json(
        { error: 'Failed to update skill rating' },
        { status: 500 }
      );
    }

    // ----- Error Classification -----
    // Classification is deferred to session end and run as a batch there
    // (see /end route), so submitting an answer never blocks on a model call.

    // ----- Insert question_attempt -----
    const { error: attemptInsertError } = await supabase
      .from('question_attempts')
      .insert({
        student_id,
        session_id: sessionId,
        question_id: question.question_id,
        student_answer: effectiveAnswer,
        is_correct: isCorrect,
        time_spent_seconds: time_spent_seconds ?? null,
        confidence_level: confidence_level ?? null,
        error_type: null,
        distractor_type: null,
        error_explanation: null,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
        attempted_at: new Date().toISOString(),
      });

    if (attemptInsertError) {
      console.error('Failed to insert attempt:', attemptInsertError);
      return NextResponse.json(
        { error: 'Failed to record attempt' },
        { status: 500 }
      );
    }

    // ----- Update session -----
    const newQuestionsAnswered = session.questions_answered + 1;
    const newSessionCorrect = session.questions_correct + (isCorrect ? 1 : 0);
    const newAccuracy = newQuestionsAnswered > 0
      ? Math.round((newSessionCorrect / newQuestionsAnswered) * 100) / 100
      : null;

    // Add sub_skill to practiced list (deduplicate)
    const subSkillsPracticed = [...new Set([
      ...session.sub_skills_practiced,
      question.sub_skill_id,
    ])];

    const { error: updateSessionError } = await supabase
      .from('sessions')
      .update({
        questions_answered: newQuestionsAnswered,
        questions_correct: newSessionCorrect,
        accuracy: newAccuracy,
        sub_skills_practiced: subSkillsPracticed,
      })
      .eq('id', sessionId);

    if (updateSessionError) {
      console.error('Failed to update session:', updateSessionError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // ----- Add to review_queue if wrong -----
    if (!isCorrect) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Upsert: if already in review queue, reset interval
      const { data: existingReview } = await supabase
        .from('review_queue')
        .select('id')
        .eq('student_id', student_id)
        .eq('question_id', question.question_id)
        .single();

      if (existingReview) {
        await supabase
          .from('review_queue')
          .update({
            next_review_date: tomorrowStr,
            interval_days: 1,
            last_review_result: false,
          })
          .eq('id', existingReview.id);
      } else {
        await supabase
          .from('review_queue')
          .insert({
            student_id,
            question_id: question.question_id,
            next_review_date: tomorrowStr,
            review_count: 0,
            last_review_result: false,
            interval_days: 1,
          });
      }
    }

    // ----- SM-2 interval escalation for correct review answers -----
    if (isCorrect) {
      const { data: existingReview } = await supabase
        .from('review_queue')
        .select('*')
        .eq('student_id', student_id)
        .eq('question_id', question.question_id)
        .maybeSingle();

      if (existingReview) {
        const review = existingReview as ReviewQueueItem;
        const nextInterval = getNextInterval(review.interval_days, true);

        if (nextInterval === -1) {
          // Mastered — remove from review queue
          await supabase.from('review_queue').delete().eq('id', review.id);
        } else {
          await supabase
            .from('review_queue')
            .update({
              next_review_date: getNextReviewDate(nextInterval),
              interval_days: nextInterval,
              review_count: review.review_count + 1,
              last_review_result: true,
            })
            .eq('id', review.id);
        }
      }
    }

    // ----- Word bank hooks -----
    // 1. Missing a Words-in-Context question auto-banks the tested word
    //    (definition backfills lazily from the Word Bank page).
    if (!isCorrect && question.sub_skill_id === 'RW-05') {
      const testedWord = (
        (question.answer_choices as Record<string, string>)[question.correct_answer] ?? ''
      ).trim();
      const normalized = testedWord.toLowerCase().replace(/[^a-z'-]/g, '');
      if (normalized.length >= 3 && /^[A-Za-z][A-Za-z' -]*$/.test(testedWord) && testedWord.split(/\s+/).length <= 2) {
        const { data: existingWord } = await supabase
          .from('word_bank')
          .select('id')
          .eq('student_id', student_id)
          .eq('normalized_word', normalized)
          .maybeSingle();
        if (!existingWord) {
          await supabase.from('word_bank').insert({
            student_id,
            word: testedWord,
            normalized_word: normalized,
            context_sentence: question.passage_text
              ? question.passage_text.slice(0, 400)
              : question.question_text.slice(0, 400),
            source_question_id: question.question_id,
            source_label: 'From a missed question',
            from_miss: true,
          });
        }
      }
    }

    // 2. Vocab drill results update the banked word's mastery
    const vocabTag = (question.tags ?? []).find((t) => t.startsWith('vocab:'));
    if (vocabTag && !skipped) {
      const normalized = vocabTag.slice('vocab:'.length);
      const { data: wordRow } = await supabase
        .from('word_bank')
        .select('id, times_drilled, times_correct, correct_streak, status')
        .eq('student_id', student_id)
        .eq('normalized_word', normalized)
        .maybeSingle();
      if (wordRow) {
        const newStreak = isCorrect ? (wordRow.correct_streak ?? 0) + 1 : 0;
        await supabase
          .from('word_bank')
          .update({
            times_drilled: (wordRow.times_drilled ?? 0) + 1,
            times_correct: (wordRow.times_correct ?? 0) + (isCorrect ? 1 : 0),
            correct_streak: newStreak,
            // Three straight correct = mastered; a miss reactivates
            status: newStreak >= 3 ? 'mastered' : isCorrect ? wordRow.status : 'active',
          })
          .eq('id', wordRow.id);
      }
    }

    // ----- Re-run frustration detection on all session attempts -----
    const { data: allAttempts } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('session_id', sessionId)
      .order('attempted_at', { ascending: true });

    const allTypedAttempts = (allAttempts || []) as QuestionAttempt[];
    const attemptSignals: AttemptSignal[] = allTypedAttempts.map((a) => ({
      isCorrect: a.is_correct,
      timeSpentSeconds: a.time_spent_seconds,
      wasSkipped: a.student_answer === 'SKIP',
    }));
    const frustrationState = detectFrustration(attemptSignals);

    // ----- Build response -----
    const subSkillName = lookupSubSkillName(question.sub_skill_id);

    const response: AttemptResponse = {
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
      question,
      elo_update: {
        sub_skill_id: question.sub_skill_id,
        sub_skill_name: subSkillName,
        previous_elo: previousElo,
        new_elo: eloResult.newElo,
        delta: eloResult.delta,
        mastery_level: getMasteryLevel(eloResult.newElo),
      },
      error_classification: null,
      frustration_state: frustrationState,
      session_stats: {
        questions_answered: newQuestionsAnswered,
        questions_correct: newSessionCorrect,
        accuracy: newAccuracy ?? 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Attempt submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
