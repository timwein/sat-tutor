import Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, interpolatePrompt } from './prompt-utils';
import { MODELS } from './claude';
import { createServerClient } from './supabase';
import { SKILL_TAXONOMY } from './types';
import type {
  QuestionAttempt,
  Question,
  SkillRating,
  InsightItem,
  DimensionDetail,
} from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MAX_WRONG_ANSWERS = 100;

export interface PatternAnalysisResult {
  topInsights: InsightItem[];
  dimensionDetails: Record<string, DimensionDetail>;
  totalWrongAnswersAnalyzed: number;
  rawAnalysis: string;
}

function lookupSubSkillName(subSkillId: string): string {
  const allSkills = [
    ...SKILL_TAXONOMY.reading_writing,
    ...SKILL_TAXONOMY.math,
  ];
  const found = allSkills.find((s) => s.id === subSkillId);
  return found ? found.name : subSkillId;
}

function buildAggregations(
  wrongAttempts: QuestionAttempt[],
  questionsMap: Record<string, Question>
) {
  // Error type distribution
  const errorTypeCounts: Record<string, number> = {};
  // Distractor type distribution
  const distractorTypeCounts: Record<string, number> = {};
  // Per sub-skill wrong counts
  const subSkillWrongCounts: Record<string, number> = {};
  // Time buckets
  let rushing = 0;
  let normal = 0;
  let overthinking = 0;
  let noTimeData = 0;
  // Confidence calibration raw counts
  let confidentWrong = 0;
  let confidentTotal = 0;
  let guessingWrong = 0;
  let guessingTotal = 0;
  let okayWrong = 0;
  let okayTotal = 0;
  // Section counts
  let mathWrong = 0;
  let rwWrong = 0;
  let passageBasedWrong = 0;
  let standaloneWrong = 0;
  // Session-based analysis
  const sessionAttemptOrder: Array<{
    session_id: string;
    is_correct: boolean;
    question_id: string;
    attempted_at: string;
  }> = [];

  for (const attempt of wrongAttempts) {
    const question = questionsMap[attempt.question_id];

    // Error types
    if (attempt.error_type) {
      errorTypeCounts[attempt.error_type] =
        (errorTypeCounts[attempt.error_type] || 0) + 1;
    }

    // Distractor types
    if (attempt.distractor_type) {
      distractorTypeCounts[attempt.distractor_type] =
        (distractorTypeCounts[attempt.distractor_type] || 0) + 1;
    }

    // Sub-skill clustering
    const subSkill = question?.sub_skill_id || 'unknown';
    subSkillWrongCounts[subSkill] = (subSkillWrongCounts[subSkill] || 0) + 1;

    // Time patterns
    if (attempt.time_spent_seconds != null) {
      if (attempt.time_spent_seconds < 30) rushing++;
      else if (attempt.time_spent_seconds > 120) overthinking++;
      else normal++;
    } else {
      noTimeData++;
    }

    // Confidence calibration (these are all wrong answers, so all count as wrong)
    if (attempt.confidence_level === 'confident') {
      confidentWrong++;
      confidentTotal++;
    } else if (attempt.confidence_level === 'guessing') {
      guessingWrong++;
      guessingTotal++;
    } else if (attempt.confidence_level === 'okay') {
      okayWrong++;
      okayTotal++;
    }

    // Section and structure
    if (question) {
      if (question.section === 'math') mathWrong++;
      else rwWrong++;
      if (question.passage_text) passageBasedWrong++;
      else standaloneWrong++;
    }

    sessionAttemptOrder.push({
      session_id: attempt.session_id,
      is_correct: attempt.is_correct,
      question_id: attempt.question_id,
      attempted_at: attempt.attempted_at,
    });
  }

  return {
    error_type_distribution: errorTypeCounts,
    distractor_type_distribution: distractorTypeCounts,
    sub_skill_wrong_counts: Object.entries(subSkillWrongCounts).map(
      ([id, count]) => ({
        sub_skill_id: id,
        name: lookupSubSkillName(id),
        wrong_count: count,
      })
    ),
    time_patterns: { rushing, normal, overthinking, no_data: noTimeData },
    confidence_calibration: {
      confident: { wrong: confidentWrong, total: confidentTotal },
      guessing: { wrong: guessingWrong, total: guessingTotal },
      okay: { wrong: okayWrong, total: okayTotal },
    },
    section_breakdown: {
      math_wrong: mathWrong,
      rw_wrong: rwWrong,
      passage_based_wrong: passageBasedWrong,
      standalone_wrong: standaloneWrong,
    },
  };
}

export async function analyzePatterns(studentId: string): Promise<PatternAnalysisResult> {
  const supabase = createServerClient();

  // Load all wrong question_attempts (excluding skips), capped at most recent 100
  const { data: wrongAttempts, error: attemptsError } = await supabase
    .from('question_attempts')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_correct', false)
    .neq('student_answer', 'SKIP')
    .order('attempted_at', { ascending: false })
    .limit(MAX_WRONG_ANSWERS);

  if (attemptsError || !wrongAttempts) {
    throw new Error('Failed to load wrong answer attempts');
  }

  const typedAttempts = wrongAttempts as QuestionAttempt[];

  // Load corresponding questions
  const questionIds = [...new Set(typedAttempts.map((a) => a.question_id))];
  const questionsMap: Record<string, Question> = {};

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

  // Load skill ratings
  const { data: skillRatings } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', studentId);

  const typedRatings = (skillRatings || []) as SkillRating[];

  // Load total attempt count for accuracy calculation
  const { count: totalAttempts } = await supabase
    .from('question_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);

  const { count: totalCorrect } = await supabase
    .from('question_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('is_correct', true);

  // Build pre-computed aggregations
  const aggregations = buildAggregations(typedAttempts, questionsMap);

  // ----- Corrections that need right AND wrong attempts -----
  // Confidence calibration and tilt can't be computed from wrong answers
  // alone, so load the recent attempt stream (both outcomes) and overwrite.
  const { data: recentAttempts } = await supabase
    .from('question_attempts')
    .select('confidence_level, is_correct, session_id, attempted_at, student_answer')
    .eq('student_id', studentId)
    .neq('student_answer', 'SKIP')
    .order('attempted_at', { ascending: false })
    .limit(300);

  if (recentAttempts && recentAttempts.length > 0) {
    type Row = {
      confidence_level: string | null;
      is_correct: boolean;
      session_id: string;
      attempted_at: string;
    };
    const rows = recentAttempts as Row[];

    // Real confidence calibration: wrong-rate per confidence level
    const calibration: Record<string, { wrong: number; total: number }> = {
      confident: { wrong: 0, total: 0 },
      okay: { wrong: 0, total: 0 },
      guessing: { wrong: 0, total: 0 },
    };
    for (const row of rows) {
      if (row.confidence_level && calibration[row.confidence_level]) {
        calibration[row.confidence_level].total++;
        if (!row.is_correct) calibration[row.confidence_level].wrong++;
      }
    }
    aggregations.confidence_calibration = {
      confident: calibration.confident,
      guessing: calibration.guessing,
      okay: calibration.okay,
    };

    // Tilt: accuracy on the question immediately after a wrong answer,
    // vs overall accuracy, within each session.
    const bySession = new Map<string, Row[]>();
    for (const row of rows) {
      if (!bySession.has(row.session_id)) bySession.set(row.session_id, []);
      bySession.get(row.session_id)!.push(row);
    }
    let afterWrongTotal = 0;
    let afterWrongCorrect = 0;
    let overallTotal = 0;
    let overallCorrect = 0;
    for (const sessionRows of bySession.values()) {
      const ordered = [...sessionRows].sort((a, b) =>
        a.attempted_at.localeCompare(b.attempted_at)
      );
      for (let i = 0; i < ordered.length; i++) {
        overallTotal++;
        if (ordered[i].is_correct) overallCorrect++;
        if (i > 0 && !ordered[i - 1].is_correct) {
          afterWrongTotal++;
          if (ordered[i].is_correct) afterWrongCorrect++;
        }
      }
    }
    (aggregations as Record<string, unknown>).cross_topic_tilt = {
      accuracy_after_a_wrong_answer:
        afterWrongTotal > 0 ? Math.round((afterWrongCorrect / afterWrongTotal) * 100) : null,
      baseline_accuracy:
        overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : null,
      sample_size: afterWrongTotal,
    };
  }

  // Previous analysis, so the model can report real trends
  // (improving / stagnant / worsening) instead of guessing.
  const { data: previousInsight } = await supabase
    .from('wrong_answer_insights')
    .select('generated_at, total_wrong_answers_analyzed, top_insights, dimension_details')
    .eq('student_id', studentId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build enriched wrong answer data (individual items for Opus context)
  const enrichedWrongAnswers = typedAttempts.slice(0, 50).map((attempt) => {
    const question = questionsMap[attempt.question_id];
    return {
      question_id: attempt.question_id,
      sub_skill_id: question?.sub_skill_id || 'unknown',
      section: question?.section || 'unknown',
      difficulty: question?.difficulty || 0,
      tags: question?.tags || [],
      has_passage: !!question?.passage_text,
      error_type: attempt.error_type,
      distractor_type: attempt.distractor_type,
      confidence_level: attempt.confidence_level,
      time_spent_seconds: attempt.time_spent_seconds,
      session_id: attempt.session_id,
    };
  });

  // Build student summary
  const studentSummary = {
    total_questions_attempted: totalAttempts ?? 0,
    total_wrong: typedAttempts.length,
    overall_accuracy:
      (totalAttempts ?? 0) > 0
        ? Math.round(((totalCorrect ?? 0) / (totalAttempts ?? 1)) * 100)
        : 0,
  };

  // Build skill ratings summary
  const skillRatingsSummary = typedRatings.map((r) => ({
    sub_skill_id: r.sub_skill_id,
    name: lookupSubSkillName(r.sub_skill_id),
    elo: r.elo_rating,
    calibrated: r.is_calibrated,
    accuracy:
      r.questions_attempted > 0
        ? Math.round((r.questions_correct / r.questions_attempted) * 100)
        : 0,
    questions_attempted: r.questions_attempted,
  }));

  // Prepare the prompt
  const promptTemplate = loadPrompt('pattern-analyzer');
  const systemPrompt = interpolatePrompt(promptTemplate, {
    student_summary: JSON.stringify(studentSummary, null, 2),
    skill_ratings: JSON.stringify(skillRatingsSummary, null, 2),
    wrong_answer_data: JSON.stringify(
      {
        aggregations,
        individual_wrong_answers: enrichedWrongAnswers,
        previous_analysis_for_trend_comparison: previousInsight ?? null,
      },
      null,
      2
    ),
  });

  // Call Claude Opus
  const response = await anthropic.messages.create({
    model: MODELS.OPUS,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Analyze these wrong answer patterns. Return JSON only.',
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '{}';
  const jsonString = text
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonString);
    return {
      topInsights: parsed.top_insights || [],
      dimensionDetails: parsed.dimension_details || {},
      totalWrongAnswersAnalyzed: typedAttempts.length,
      rawAnalysis: text,
    };
  } catch {
    // Return minimal fallback on parse failure
    return {
      topInsights: [
        {
          dimension: 'Error Type Distribution',
          finding:
            'Analysis could not be completed automatically. Please try regenerating.',
          severity: 'low' as const,
          trend: 'stagnant' as const,
          recommendation: 'Try generating the analysis again.',
          evidence_question_ids: [],
        },
      ],
      dimensionDetails: {},
      totalWrongAnswersAnalyzed: typedAttempts.length,
      rawAnalysis: text,
    };
  }
}
