import type { SupabaseClient } from '@supabase/supabase-js';
import { SKILL_TAXONOMY } from './types';
import type { SkillRating, ScorePrediction } from './types';
import { getMasteryLevel } from './elo';

const skillNames = new Map<string, string>(
  [...SKILL_TAXONOMY.math, ...SKILL_TAXONOMY.reading_writing].map((s) => [s.id, s.name])
);

/**
 * Compact tutor-facing profile, built server-side so explanations can be
 * personalized ("you tend to rush algebra setups") without trusting the client.
 */
export async function buildTutorProfile(
  supabase: SupabaseClient,
  studentId: string,
  focusSubSkillId?: string
): Promise<Record<string, unknown>> {
  const [{ data: ratingsData }, { data: predictionData }, { data: wrongData }] =
    await Promise.all([
      supabase.from('skill_ratings').select('*').eq('student_id', studentId),
      supabase
        .from('score_predictions')
        .select('*')
        .eq('student_id', studentId)
        .order('predicted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('question_attempts')
        .select('error_type, confidence_level, is_correct')
        .eq('student_id', studentId)
        .eq('is_correct', false)
        .not('error_type', 'is', null)
        .order('attempted_at', { ascending: false })
        .limit(50),
    ]);

  const ratings = (ratingsData ?? []) as SkillRating[];
  const prediction = predictionData as ScorePrediction | null;

  const weaknesses = [...ratings]
    .filter((r) => r.is_calibrated)
    .sort((a, b) => a.elo_rating - b.elo_rating)
    .slice(0, 3)
    .map((r) => ({
      skill: skillNames.get(r.sub_skill_id) ?? r.sub_skill_id,
      elo: r.elo_rating,
      accuracy:
        r.questions_attempted > 0
          ? Math.round((r.questions_correct / r.questions_attempted) * 100)
          : null,
    }));

  const errorCounts = new Map<string, number>();
  for (const attempt of wrongData ?? []) {
    const type = (attempt as { error_type: string | null }).error_type;
    if (type) errorCounts.set(type, (errorCounts.get(type) ?? 0) + 1);
  }
  const commonErrorTypes = [...errorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => ({ type, count }));

  const focal = focusSubSkillId
    ? ratings.find((r) => r.sub_skill_id === focusSubSkillId)
    : undefined;

  return {
    predicted_score: prediction
      ? { total: prediction.total_score_mid, rw: prediction.rw_score, math: prediction.math_score }
      : null,
    top_weaknesses: weaknesses,
    common_error_types: commonErrorTypes,
    current_skill: focal
      ? {
          skill: skillNames.get(focal.sub_skill_id) ?? focal.sub_skill_id,
          elo: focal.elo_rating,
          mastery: getMasteryLevel(focal.elo_rating),
          accuracy:
            focal.questions_attempted > 0
              ? Math.round((focal.questions_correct / focal.questions_attempted) * 100)
              : null,
        }
      : null,
  };
}
