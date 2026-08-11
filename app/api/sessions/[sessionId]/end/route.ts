import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, interpolatePrompt } from '@/lib/prompt-utils';
import { MODELS, classifyError } from '@/lib/claude';

const VALID_ERROR_TYPES = new Set([
  'conceptual_gap', 'procedural_error', 'careless_rush',
  'misread_comprehension', 'trap_answer', 'time_pressure', 'knowledge_gap',
]);
import { predictScore } from '@/lib/score-predictor';
import type { Session, QuestionAttempt, Question } from '@/lib/types';
import { SKILL_TAXONOMY } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json(
        { error: 'Missing required field: student_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

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

    // Set ended_at
    const endedAt = new Date().toISOString();

    // Load all attempts for this session with their questions
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('session_id', sessionId)
      .order('attempted_at', { ascending: true });

    if (attemptsError) {
      console.error('Failed to load attempts:', attemptsError);
      return NextResponse.json(
        { error: 'Failed to load session attempts' },
        { status: 500 }
      );
    }

    const typedAttempts = (attempts || []) as QuestionAttempt[];

    // Load questions for these attempts
    const questionIds = [...new Set(typedAttempts.map((a) => a.question_id))];
    let questionsMap: Record<string, Question> = {};

    if (questionIds.length > 0) {
      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .in('question_id', questionIds);

      if (questions) {
        for (const q of questions as Question[]) {
          questionsMap[q.question_id] = q;
        }
      }
    }

    // ----- Batched error classification -----
    // Wrong answers are classified here (not per-attempt during the session)
    // so submits stay fast; run with limited concurrency, non-fatal.
    const toClassify = typedAttempts.filter(
      (a) => !a.is_correct && a.student_answer !== 'SKIP' && !a.error_type && questionsMap[a.question_id]
    );
    const CLASSIFY_CONCURRENCY = 3;
    for (let i = 0; i < toClassify.length; i += CLASSIFY_CONCURRENCY) {
      const batch = toClassify.slice(i, i + CLASSIFY_CONCURRENCY);
      await Promise.all(
        batch.map(async (attempt) => {
          try {
            const classification = await classifyError({
              question: questionsMap[attempt.question_id],
              studentAnswer: attempt.student_answer,
              timeSpentSeconds: attempt.time_spent_seconds,
              confidenceLevel: attempt.confidence_level,
            });
            const safeErrorType = VALID_ERROR_TYPES.has(classification.error_type)
              ? classification.error_type
              : null;
            attempt.error_type = safeErrorType;
            attempt.distractor_type = classification.distractor_type;
            attempt.error_explanation = classification.explanation;
            await supabase
              .from('question_attempts')
              .update({
                error_type: safeErrorType,
                distractor_type: classification.distractor_type,
                error_explanation: classification.explanation,
              })
              .eq('id', attempt.id);
          } catch (classifyErr) {
            console.error('Batch classification failed (non-fatal):', classifyErr);
          }
        })
      );
    }

    // Build summary context
    const startedAt = new Date(session.started_at);
    const ended = new Date(endedAt);
    const durationMinutes = Math.round((ended.getTime() - startedAt.getTime()) / (1000 * 60));

    const subSkillBreakdown: Record<string, { correct: number; total: number }> = {};
    const errorTypes: Record<string, number> = {};

    for (const attempt of typedAttempts) {
      const q = questionsMap[attempt.question_id];
      const subSkillId = q?.sub_skill_id || 'unknown';

      if (!subSkillBreakdown[subSkillId]) {
        subSkillBreakdown[subSkillId] = { correct: 0, total: 0 };
      }
      subSkillBreakdown[subSkillId].total++;
      if (attempt.is_correct) {
        subSkillBreakdown[subSkillId].correct++;
      }

      if (attempt.error_type) {
        errorTypes[attempt.error_type] = (errorTypes[attempt.error_type] || 0) + 1;
      }
    }

    // Map sub-skill IDs to names
    const subSkillSummary: Record<string, { name: string; correct: number; total: number }> = {};
    for (const [id, stats] of Object.entries(subSkillBreakdown)) {
      subSkillSummary[id] = {
        name: lookupSubSkillName(id),
        ...stats,
      };
    }

    const summaryContext = {
      session_type: session.session_type,
      duration_minutes: durationMinutes,
      questions_answered: session.questions_answered,
      questions_correct: session.questions_correct,
      accuracy: session.accuracy,
      sub_skills: subSkillSummary,
      error_types: errorTypes,
      skipped_count: typedAttempts.filter((a) => a.student_answer === 'SKIP').length,
    };

    // Generate summary via Claude
    let summaryText = '';
    try {
      const promptTemplate = loadPrompt('session-summary');
      const systemPrompt = interpolatePrompt(promptTemplate, {
        session_data: JSON.stringify(summaryContext, null, 2),
      });

      const response = await anthropic.messages.create({
        model: MODELS.SONNET,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate the session summary.' }],
      });

      summaryText = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (summaryErr) {
      console.error('Summary generation failed:', summaryErr);
      // Non-fatal: provide a fallback summary
      summaryText = `You answered ${session.questions_answered} questions with ${Math.round((session.accuracy ?? 0) * 100)}% accuracy. Great effort!`;
    }

    // Update session with ended_at and summary
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        ended_at: endedAt,
        summary: summaryText,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return NextResponse.json(
        { error: 'Failed to end session' },
        { status: 500 }
      );
    }

    // Upsert daily_activity for today
    const today = new Date().toISOString().split('T')[0];

    const { data: existingActivity } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('student_id', student_id)
      .eq('activity_date', today)
      .single();

    if (existingActivity) {
      await supabase
        .from('daily_activity')
        .update({
          questions_answered: existingActivity.questions_answered + session.questions_answered,
          streak_qualifying: (existingActivity.questions_answered + session.questions_answered) >= 10,
        })
        .eq('id', existingActivity.id);
    } else {
      await supabase
        .from('daily_activity')
        .insert({
          student_id,
          activity_date: today,
          questions_answered: session.questions_answered,
          streak_qualifying: session.questions_answered >= 10,
        });
    }

    // Non-blocking score prediction after session ends
    try {
      const { count: totalQuestions } = await supabase
        .from('question_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', student_id);

      if ((totalQuestions ?? 0) >= 10) {
        const prediction = await predictScore(student_id);
        await supabase.from('score_predictions').insert({
          student_id,
          total_score_low: prediction.totalScoreLow,
          total_score_mid: prediction.totalScoreMid,
          total_score_high: prediction.totalScoreHigh,
          rw_score: prediction.rwScore,
          math_score: prediction.mathScore,
          confidence: prediction.confidence,
        });
      }
    } catch (predictionErr) {
      console.error('Score prediction failed (non-fatal):', predictionErr);
    }

    // Update micro-goal progress (non-fatal)
    try {
      const { updateGoalProgress } = await import('@/lib/micro-goals');
      await updateGoalProgress(student_id);
    } catch (goalErr) {
      console.error('Goal progress update failed (non-fatal):', goalErr);
    }

    // Recommend an insights refresh when enough new wrong answers have
    // accumulated since the last analysis (spec: every 5 new wrong answers).
    let insightsRefreshRecommended = false;
    try {
      const { count: totalWrong } = await supabase
        .from('question_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', student_id)
        .eq('is_correct', false)
        .neq('student_answer', 'SKIP');

      const { data: latestInsight } = await supabase
        .from('wrong_answer_insights')
        .select('total_wrong_answers_analyzed')
        .eq('student_id', student_id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const wrongCount = totalWrong ?? 0;
      const analyzed = latestInsight?.total_wrong_answers_analyzed ?? 0;
      insightsRefreshRecommended = latestInsight
        ? wrongCount - analyzed >= 5
        : wrongCount >= 10;
    } catch (insightErr) {
      console.error('Insight refresh check failed (non-fatal):', insightErr);
    }

    return NextResponse.json({
      ...(updatedSession as Session),
      insights_refresh_recommended: insightsRefreshRecommended,
    });
  } catch (error) {
    console.error('Session end error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
