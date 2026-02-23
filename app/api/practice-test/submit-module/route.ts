import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { calculateEloAdjustment, getMasteryLevel } from '@/lib/elo';
import { classifyError } from '@/lib/claude';
import { analyzePacing } from '@/lib/pacing-analyzer';
import { SKILL_TAXONOMY } from '@/lib/types';
import type {
  Question,
  Session,
  SkillRating,
  EloUpdate,
  ErrorClassification,
  QuestionResult,
  ModuleResult,
} from '@/lib/types';

function lookupSubSkillName(subSkillId: string): string {
  const allSkills = [
    ...SKILL_TAXONOMY.reading_writing,
    ...SKILL_TAXONOMY.math,
  ];
  const found = allSkills.find((s) => s.id === subSkillId);
  return found ? found.name : subSkillId;
}

interface SubmitAnswer {
  question_id: string;
  student_answer: string | null;
  time_spent_seconds: number;
  confidence_level: 'guessing' | 'okay' | 'confident' | null;
}

// Throttled error classification: max 3 concurrent calls
async function classifyErrorsThrottled(
  items: Array<{ question: Question; studentAnswer: string; timeSpent: number; confidence: string | null }>
): Promise<Map<string, ErrorClassification>> {
  const results = new Map<string, ErrorClassification>();
  const concurrency = 3;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(async (item) => {
      try {
        const classification = await classifyError({
          question: item.question,
          studentAnswer: item.studentAnswer,
          timeSpentSeconds: item.timeSpent,
          confidenceLevel: item.confidence,
        });
        results.set(item.question.question_id, classification);
      } catch (err) {
        console.error(`Error classifying ${item.question.question_id}:`, err);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, session_id, module_id, answers } = body as {
      student_id: string;
      session_id: string;
      module_id: string;
      answers: SubmitAnswer[];
    };

    if (!student_id || !session_id || !module_id || !answers?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, session_id, module_id, answers' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Load session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
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

    // Load all questions referenced in answers
    const questionIds = answers.map((a) => a.question_id);
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .in('question_id', questionIds);

    if (questionsError || !questionsData) {
      return NextResponse.json(
        { error: 'Failed to load questions' },
        { status: 500 }
      );
    }

    const questionsMap: Record<string, Question> = {};
    for (const q of questionsData as Question[]) {
      questionsMap[q.question_id] = q;
    }

    // Load existing skill ratings for this student
    const { data: existingRatings } = await supabase
      .from('skill_ratings')
      .select('*')
      .eq('student_id', student_id);

    const ratingsMap: Record<string, SkillRating> = {};
    for (const r of (existingRatings || []) as SkillRating[]) {
      ratingsMap[r.sub_skill_id] = r;
    }

    // Process each answer: grade, Elo, classify errors
    const questionResults: QuestionResult[] = [];
    const eloUpdates: EloUpdate[] = [];
    const wrongItems: Array<{ question: Question; studentAnswer: string; timeSpent: number; confidence: string | null }> = [];
    let totalCorrect = 0;
    const subSkillsPracticed = new Set<string>();
    let totalTimeUsedSeconds = 0;

    for (const answer of answers) {
      const question = questionsMap[answer.question_id];
      if (!question) continue;

      const studentAnswer = answer.student_answer;
      const isCorrect = studentAnswer
        ? studentAnswer.toUpperCase() === question.correct_answer.toUpperCase()
        : false;

      if (isCorrect) totalCorrect++;
      totalTimeUsedSeconds += answer.time_spent_seconds;
      subSkillsPracticed.add(question.sub_skill_id);

      // Elo update
      let currentRating = ratingsMap[question.sub_skill_id];

      if (!currentRating) {
        // Create new skill rating
        const { data: newRating } = await supabase
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

        if (newRating) {
          currentRating = newRating as SkillRating;
          ratingsMap[question.sub_skill_id] = currentRating;
        }
      }

      if (currentRating) {
        const previousElo = currentRating.elo_rating;
        const eloResult = calculateEloAdjustment({
          currentElo: previousElo,
          questionDifficulty: question.difficulty,
          isCorrect,
          questionsAttempted: currentRating.questions_attempted,
        });

        currentRating.elo_rating = eloResult.newElo;
        currentRating.questions_attempted++;
        if (isCorrect) currentRating.questions_correct++;
        currentRating.is_calibrated = currentRating.questions_attempted >= 5;

        // Update in DB
        await supabase
          .from('skill_ratings')
          .update({
            elo_rating: eloResult.newElo,
            questions_attempted: currentRating.questions_attempted,
            questions_correct: currentRating.questions_correct,
            is_calibrated: currentRating.is_calibrated,
            last_updated: new Date().toISOString(),
          })
          .eq('id', currentRating.id);

        eloUpdates.push({
          sub_skill_id: question.sub_skill_id,
          sub_skill_name: lookupSubSkillName(question.sub_skill_id),
          previous_elo: previousElo,
          new_elo: eloResult.newElo,
          delta: eloResult.delta,
          mastery_level: getMasteryLevel(eloResult.newElo),
        });
      }

      // Collect wrong answers for error classification
      if (!isCorrect && studentAnswer) {
        wrongItems.push({
          question,
          studentAnswer,
          timeSpent: answer.time_spent_seconds,
          confidence: answer.confidence_level,
        });
      }

      questionResults.push({
        questionId: answer.question_id,
        studentAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        timeSpentSeconds: answer.time_spent_seconds,
        confidenceLevel: answer.confidence_level,
        errorClassification: null, // filled in after batch classification
        question,
      });
    }

    // Run error classification in batches (throttled)
    const errorClassifications = await classifyErrorsThrottled(wrongItems);

    // Apply classifications to results
    for (const result of questionResults) {
      if (!result.isCorrect && result.studentAnswer) {
        result.errorClassification = errorClassifications.get(result.questionId) || null;
      }
    }

    // Insert question_attempts in batch
    const attemptRows = answers.map((answer) => {
      const question = questionsMap[answer.question_id];
      const result = questionResults.find((r) => r.questionId === answer.question_id);
      const classification = result?.errorClassification;

      return {
        student_id,
        session_id,
        question_id: answer.question_id,
        student_answer: answer.student_answer || 'SKIP',
        is_correct: result?.isCorrect ?? false,
        time_spent_seconds: answer.time_spent_seconds,
        confidence_level: answer.confidence_level,
        error_type: classification?.error_type ?? null,
        distractor_type: classification?.distractor_type ?? null,
        error_explanation: classification?.explanation ?? null,
        attempted_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase
      .from('question_attempts')
      .insert(attemptRows);

    if (insertError) {
      console.error('Failed to insert attempts:', insertError);
    }

    // Add wrong answers to review queue
    for (const result of questionResults) {
      if (!result.isCorrect) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const { data: existingReview } = await supabase
          .from('review_queue')
          .select('id')
          .eq('student_id', student_id)
          .eq('question_id', result.questionId)
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
              question_id: result.questionId,
              next_review_date: tomorrowStr,
              review_count: 0,
              last_review_result: false,
              interval_days: 1,
            });
        }
      }
    }

    // Update session stats
    const accuracy = answers.length > 0
      ? Math.round((totalCorrect / answers.length) * 100) / 100
      : null;

    await supabase
      .from('sessions')
      .update({
        questions_answered: answers.length,
        questions_correct: totalCorrect,
        accuracy,
        ended_at: new Date().toISOString(),
        sub_skills_practiced: [...subSkillsPracticed],
      })
      .eq('id', session_id);

    // Run pacing analysis
    const section = questionResults[0]?.question?.section || 'math';
    const metadata = (sessionData as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    const timeLimitSeconds = (metadata?.time_limit_seconds as number) || (section === 'math' ? 35 * 60 : 32 * 60);

    const pacingAnalysis = analyzePacing(questionResults, section, timeLimitSeconds);

    const moduleResult: ModuleResult = {
      sessionId: session_id,
      moduleId: module_id,
      section,
      questionResults,
      totalCorrect,
      totalQuestions: answers.length,
      accuracy: accuracy ?? 0,
      timeLimitSeconds,
      totalTimeUsedSeconds,
      pacingAnalysis,
      eloUpdates,
    };

    return NextResponse.json(moduleResult);
  } catch (error) {
    console.error('Submit module error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
