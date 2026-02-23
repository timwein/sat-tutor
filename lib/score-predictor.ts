import Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, interpolatePrompt } from './prompt-utils';
import { MODELS } from './claude';
import { createServerClient } from './supabase';
import { SKILL_TAXONOMY } from './types';
import type { SkillRating } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MIN_QUESTIONS_FOR_CLAUDE = 10;

export interface ScorePredictionResult {
  totalScoreLow: number;
  totalScoreMid: number;
  totalScoreHigh: number;
  rwScore: number;
  mathScore: number;
  confidence: number;
}

function simpleFormulaPredict(ratings: SkillRating[]): ScorePredictionResult {
  const rwSkillIds = new Set<string>(SKILL_TAXONOMY.reading_writing.map((s) => s.id));
  const mathSkillIds = new Set<string>(SKILL_TAXONOMY.math.map((s) => s.id));

  let rwSum = 0;
  let rwCount = 0;
  let mathSum = 0;
  let mathCount = 0;

  for (const r of ratings) {
    if (rwSkillIds.has(r.sub_skill_id)) {
      rwSum += r.elo_rating;
      rwCount++;
    } else if (mathSkillIds.has(r.sub_skill_id)) {
      mathSum += r.elo_rating;
      mathCount++;
    }
  }

  // Default to 1000 Elo for unattempted skills
  const rwAvgElo = rwCount > 0 ? rwSum / rwCount : 1000;
  const mathAvgElo = mathCount > 0 ? mathSum / mathCount : 1000;

  // Map Elo to SAT section score: section = 200 + (elo / 2000) * 600
  const rwScore = Math.round(200 + (rwAvgElo / 2000) * 600);
  const mathScore = Math.round(200 + (mathAvgElo / 2000) * 600);
  const mid = rwScore + mathScore;

  return {
    totalScoreLow: Math.max(400, mid - 120),
    totalScoreMid: mid,
    totalScoreHigh: Math.min(1600, mid + 120),
    rwScore: Math.max(200, Math.min(800, rwScore)),
    mathScore: Math.max(200, Math.min(800, mathScore)),
    confidence: 0.3,
  };
}

export async function predictScore(
  studentId: string
): Promise<ScorePredictionResult> {
  const supabase = createServerClient();

  // Load skill ratings
  const { data: ratingsData } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', studentId);

  const ratings = (ratingsData || []) as SkillRating[];

  // Check total questions attempted
  const totalAttempted = ratings.reduce(
    (sum, r) => sum + r.questions_attempted,
    0
  );

  // Below threshold: use simple formula
  if (totalAttempted < MIN_QUESTIONS_FOR_CLAUDE) {
    return simpleFormulaPredict(ratings);
  }

  // Build skill ratings JSON for prompt
  const allSkills = [
    ...SKILL_TAXONOMY.reading_writing,
    ...SKILL_TAXONOMY.math,
  ];

  const ratingsMap = new Map<string, SkillRating>();
  for (const r of ratings) {
    ratingsMap.set(r.sub_skill_id, r);
  }

  const skillRatingsJson = allSkills.map((skill) => {
    const rating = ratingsMap.get(skill.id);
    return {
      sub_skill_id: skill.id,
      name: skill.name,
      section:
        SKILL_TAXONOMY.reading_writing.find((s) => s.id === skill.id)
          ? 'reading_writing'
          : 'math',
      elo_rating: rating?.elo_rating ?? 1000,
      questions_attempted: rating?.questions_attempted ?? 0,
      is_calibrated: rating?.is_calibrated ?? false,
    };
  });

  // Load overall stats
  const { count: totalSessions } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .not('ended_at', 'is', null);

  const totalCorrect = ratings.reduce(
    (sum, r) => sum + r.questions_correct,
    0
  );
  const overallAccuracy =
    totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  const overallStats = {
    total_questions_attempted: totalAttempted,
    total_correct: totalCorrect,
    overall_accuracy_percent: overallAccuracy,
    sessions_completed: totalSessions ?? 0,
    calibrated_skills: ratings.filter((r) => r.is_calibrated).length,
    total_skills: allSkills.length,
  };

  // Build and call Sonnet
  const promptTemplate = loadPrompt('score-predictor');
  const systemPrompt = interpolatePrompt(promptTemplate, {
    skill_ratings_json: JSON.stringify(skillRatingsJson, null, 2),
    overall_stats: JSON.stringify(overallStats, null, 2),
  });

  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: 'Predict this student\'s SAT score. Return JSON only.',
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonString = text
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonString);
    return {
      totalScoreLow: Math.max(400, Math.min(1600, parsed.total_score_low ?? 800)),
      totalScoreMid: Math.max(400, Math.min(1600, parsed.total_score_mid ?? 1000)),
      totalScoreHigh: Math.max(400, Math.min(1600, parsed.total_score_high ?? 1200)),
      rwScore: Math.max(200, Math.min(800, parsed.rw_score ?? 500)),
      mathScore: Math.max(200, Math.min(800, parsed.math_score ?? 500)),
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
    };
  } catch {
    // Fallback to simple formula
    return simpleFormulaPredict(ratings);
  }
}
