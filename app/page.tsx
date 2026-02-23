import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  BookOpen,
  Lightbulb,
  BarChart3,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Minus,
  Flame,
} from 'lucide-react';
import { createServerClient } from '@/lib/supabase';
import { computeCurrentStreak, getWeeklyStats } from '@/lib/streak-calculator';
import { getOrGenerateWeeklyGoals } from '@/lib/micro-goals';
import { MicroGoals } from '@/components/micro-goals';
import type { StreakData, WeeklyStats } from '@/lib/streak-calculator';
import type { ScorePrediction } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = createServerClient();

  // 1. Load student
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  // 2. Load latest score prediction
  const { data: latestPrediction } = await supabase
    .from('score_predictions')
    .select('*')
    .eq('student_id', studentId)
    .order('predicted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Load previous prediction for trend arrow
  const { data: predictions } = await supabase
    .from('score_predictions')
    .select('*')
    .eq('student_id', studentId)
    .order('predicted_at', { ascending: false })
    .limit(2);
  const prevPrediction =
    predictions && predictions.length > 1
      ? (predictions[1] as ScorePrediction)
      : null;
  const prediction = latestPrediction as ScorePrediction | null;

  // 4. Compute streak
  const streakData: StreakData = await computeCurrentStreak(studentId);

  // 5. Compute weekly stats
  const weeklyStats: WeeklyStats = await getWeeklyStats(studentId);

  // 6. Review due count
  const today = new Date().toISOString().split('T')[0];
  const { count: reviewDueCount } = await supabase
    .from('review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .lte('next_review_date', today);

  // 7. Load micro-goals
  let goals: Awaited<ReturnType<typeof getOrGenerateWeeklyGoals>> = [];
  try {
    goals = await getOrGenerateWeeklyGoals(studentId);
  } catch {
    // Non-fatal: goals may fail if table doesn't exist yet
  }

  // Trend calculation
  const delta =
    prediction && prevPrediction
      ? prediction.total_score_mid - prevPrediction.total_score_mid
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 md:space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Welcome back, Oren</h1>
        <p className="mt-1 text-gray-500">
          Keep up the momentum. Your next study session is waiting.
        </p>
      </div>

      {/* Score Prediction Widget */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Predicted SAT Score</CardTitle>
          <CardDescription className="text-blue-700">
            Based on your performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prediction ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-blue-900 md:text-5xl">
                  {prediction.total_score_mid}
                </span>
                <span className="text-lg text-blue-600">/ 1600</span>
                {delta !== null && (
                  <span className="ml-2 flex items-center gap-1 text-sm font-medium">
                    {delta > 0 && (
                      <>
                        <ArrowUp className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">+{delta}</span>
                      </>
                    )}
                    {delta < 0 && (
                      <>
                        <ArrowDown className="h-4 w-4 text-red-600" />
                        <span className="text-red-600">{delta}</span>
                      </>
                    )}
                    {delta === 0 && (
                      <>
                        <Minus className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-400">No change</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-blue-700">
                Range: {prediction.total_score_low} &ndash;{' '}
                {prediction.total_score_high}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                R/W: {prediction.rw_score} | Math: {prediction.math_score}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-blue-900 md:text-5xl">--</span>
                <span className="text-lg text-blue-600">/ 1600</span>
              </div>
              <p className="mt-2 text-sm text-blue-700">
                Complete more practice sessions to generate your score prediction.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/study">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <BookOpen className="h-10 w-10 text-blue-600" />
              <h3 className="font-semibold">Start Studying</h3>
              <p className="text-center text-sm text-gray-500">
                Adaptive practice session
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/insights">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <Lightbulb className="h-10 w-10 text-yellow-500" />
              <h3 className="font-semibold">
                Insights <Badge variant="secondary" className="ml-1">&#9733;</Badge>
              </h3>
              <p className="text-center text-sm text-gray-500">
                Wrong answer intelligence
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/progress">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <BarChart3 className="h-10 w-10 text-green-600" />
              <h3 className="font-semibold">My Progress</h3>
              <p className="text-center text-sm text-gray-500">
                Analytics and skill map
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/review">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="relative flex flex-col items-center gap-3 pt-6">
              <RotateCcw className="h-10 w-10 text-purple-600" />
              <h3 className="font-semibold">
                Review Queue
                {(reviewDueCount ?? 0) > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {reviewDueCount}
                  </span>
                )}
              </h3>
              <p className="text-center text-sm text-gray-500">
                Spaced repetition
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Streak + This Week */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Streak Card */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {streakData.currentStreak}
              </span>
              <span className="text-gray-500">days</span>
              {streakData.currentStreak > 0 && (
                <Flame className="h-6 w-6 text-orange-500" />
              )}
            </div>
            {streakData.milestoneReached ? (
              <p className="mt-2 text-sm font-medium text-orange-600">
                {'\uD83C\uDFAF'} {streakData.milestoneReached}-day milestone!
              </p>
            ) : streakData.currentStreak === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                Complete a study session to start your streak!
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* This Week Card */}
        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Questions answered</span>
                <span className="font-medium">{weeklyStats.questionsAnswered}</span>
              </div>
              <div className="flex justify-between">
                <span>Study sessions</span>
                <span className="font-medium">{weeklyStats.sessionsCompleted}</span>
              </div>
              <div className="flex justify-between">
                <span>Accuracy</span>
                <span className="font-medium">
                  {weeklyStats.accuracy !== null
                    ? weeklyStats.accuracy + '%'
                    : '--'}
                </span>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span>Days active</span>
                  <span className="font-medium">
                    {weeklyStats.daysActive} of 7
                  </span>
                </div>
                <Progress
                  value={Math.round((weeklyStats.daysActive / 7) * 100)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Goals */}
      {goals.length > 0 && <MicroGoals goals={goals} />}
    </div>
  );
}
