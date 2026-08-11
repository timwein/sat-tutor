'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Minus, Clock } from 'lucide-react';
import type { ParentDashboardData } from '@/lib/parent-dashboard';

interface ParentOverviewProps {
  data: ParentDashboardData;
}

const MASTERY_BADGE_STYLES: Record<string, string> = {
  Developing: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200',
  Progressing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Proficient: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200',
  Mastered: 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border-green-200',
};

export function ParentOverview({ data }: ParentOverviewProps) {
  const { scorePrediction, scoreTrend, studyTime, sessionFrequency, topWeaknesses } =
    data;

  return (
    <div className="space-y-6">
      {/* Score Prediction Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/40">
        <CardHeader>
          <CardTitle className="text-blue-900">Predicted SAT Score</CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            Based on your student&apos;s performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scorePrediction ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-blue-900">
                  {scorePrediction.total_score_mid}
                </span>
                <span className="text-lg text-blue-600">/ 1600</span>
                {scoreTrend && (
                  <span className="ml-2 flex items-center gap-1 text-sm font-medium">
                    {scoreTrend.direction === 'up' && (
                      <>
                        <ArrowUp className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">
                          +{scoreTrend.delta}
                        </span>
                      </>
                    )}
                    {scoreTrend.direction === 'down' && (
                      <>
                        <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-red-600 dark:text-red-400">
                          {scoreTrend.delta}
                        </span>
                      </>
                    )}
                    {scoreTrend.direction === 'flat' && (
                      <>
                        <Minus className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-400 dark:text-gray-500">No change</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Range: {scorePrediction.total_score_low} &ndash;{' '}
                {scorePrediction.total_score_high}
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                R/W: {scorePrediction.rw_score} | Math:{' '}
                {scorePrediction.math_score}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-blue-900">--</span>
                <span className="text-lg text-blue-600">/ 1600</span>
              </div>
              <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                Not enough data for a score prediction yet.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Study Activity Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Study Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              Study Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">This week</span>
                <span className="text-sm font-semibold">
                  {studyTime.thisWeekMinutes < 60
                    ? `${studyTime.thisWeekMinutes} min`
                    : `${Math.floor(studyTime.thisWeekMinutes / 60)}h ${studyTime.thisWeekMinutes % 60}m`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">This month</span>
                <span className="text-sm font-semibold">
                  {studyTime.thisMonthMinutes < 60
                    ? `${studyTime.thisMonthMinutes} min`
                    : `${Math.floor(studyTime.thisMonthMinutes / 60)}h ${studyTime.thisMonthMinutes % 60}m`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Frequency */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Session Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">This week</span>
                <span className="text-sm font-semibold">
                  {sessionFrequency.thisWeek}{' '}
                  {sessionFrequency.thisWeek === 1 ? 'session' : 'sessions'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">This month</span>
                <span className="text-sm font-semibold">
                  {sessionFrequency.thisMonth}{' '}
                  {sessionFrequency.thisMonth === 1 ? 'session' : 'sessions'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Weaknesses */}
      <Card>
        <CardHeader>
          <CardTitle>Top Weaknesses</CardTitle>
          <CardDescription>
            Skills that need the most attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topWeaknesses.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No calibrated skills yet. More practice is needed.
            </p>
          ) : (
            <div className="space-y-3">
              {topWeaknesses.map((w) => (
                <div
                  key={w.skillId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{w.skillName}</p>
                    <Badge
                      variant="outline"
                      className="text-xs text-gray-600 dark:text-gray-300"
                    >
                      {w.domain}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Elo {w.elo}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {w.accuracy}% acc
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        MASTERY_BADGE_STYLES[w.mastery] ?? ''
                      }
                    >
                      {w.mastery}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
