import { createServerClient } from '@/lib/supabase';
import { SKILL_TAXONOMY } from '@/lib/types';
import type { SkillRating, ScorePrediction, Session } from '@/lib/types';
import { getMasteryLevel } from '@/lib/elo';
import { computeCurrentStreak, getActivityDays } from '@/lib/streak-calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressTabs } from '@/components/progress-tabs';

export default async function ProgressPage() {
  const supabase = createServerClient();

  // Load student
  const { data: student } = await supabase
    .from('students').select('*').limit(1).single();
  const studentId = student?.id ?? '';

  // Load skill ratings
  const { data: skillRatings } = await supabase
    .from('skill_ratings').select('*').eq('student_id', studentId);
  const ratings = (skillRatings ?? []) as SkillRating[];

  // Load latest score prediction
  const { data: scorePrediction } = await supabase
    .from('score_predictions').select('*')
    .eq('student_id', studentId)
    .order('predicted_at', { ascending: false })
    .limit(1).maybeSingle();
  const prediction = scorePrediction as ScorePrediction | null;

  // Load recent completed sessions
  const { data: sessionsData } = await supabase
    .from('sessions').select('*')
    .eq('student_id', studentId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20);
  const sessions = (sessionsData ?? []) as Session[];

  // Load activity days for heatmap (last 12 months)
  const activityDays = await getActivityDays(studentId, 12);

  // Load streak data
  const streakData = await computeCurrentStreak(studentId);

  // Compute aggregate stats
  const totalAttempted = ratings.reduce((sum, r) => sum + r.questions_attempted, 0);
  const totalCorrect = ratings.reduce((sum, r) => sum + r.questions_correct, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-3xl font-bold">My Progress</h1>
      <p className="text-gray-500">Track your skill development across all SAT sub-skills.</p>

      {/* Stats cards row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Predicted Score</CardTitle></CardHeader>
          <CardContent>
            {prediction ? (
              <>
                <span className="text-3xl font-bold">{prediction.total_score_mid}</span>
                <p className="mt-1 text-xs text-gray-500">
                  {prediction.total_score_low} - {prediction.total_score_high}
                </p>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold text-gray-400">--</span>
                <p className="mt-1 text-xs text-gray-500">Not enough data yet</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Questions Answered</CardTitle></CardHeader>
          <CardContent><span className="text-3xl font-bold">{totalAttempted}</span></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Overall Accuracy</CardTitle></CardHeader>
          <CardContent>
            {overallAccuracy !== null ? (
              <span className="text-3xl font-bold">{overallAccuracy}%</span>
            ) : (
              <span className="text-3xl font-bold text-gray-400">--</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabbed content */}
      <ProgressTabs
        skillRatings={ratings}
        sessions={sessions}
        activityDays={activityDays}
        streakData={streakData}
        studentId={studentId}
      />
    </div>
  );
}
