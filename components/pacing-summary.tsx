'use client';

import { Clock, AlertTriangle, Zap, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PacingAnalysis } from '@/lib/types';

interface PacingSummaryProps {
  analysis: PacingAnalysis;
}

const PACE_RATING_CONFIG = {
  good: {
    label: 'Good Pace',
    className: 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300',
    icon: CheckCircle,
  },
  too_fast: {
    label: 'Too Fast',
    className: 'bg-orange-100 text-orange-700',
    icon: Zap,
  },
  too_slow: {
    label: 'Too Slow',
    className: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300',
    icon: Clock,
  },
} as const;

export function PacingSummary({ analysis }: PacingSummaryProps) {
  const ratingConfig = PACE_RATING_CONFIG[analysis.paceRating];
  const RatingIcon = ratingConfig.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pacing Analysis</CardTitle>
          <Badge
            variant="outline"
            className={cn('gap-1', ratingConfig.className)}
          >
            <RatingIcon className="h-3 w-3" />
            {ratingConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
            <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm font-semibold">
                {analysis.averageTimeSeconds.toFixed(1)}s
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Average Time</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
            <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-sm font-semibold">
                {analysis.medianTimeSeconds.toFixed(1)}s
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Median Time</p>
            </div>
          </div>
        </div>

        {/* Time sinks */}
        {analysis.timeSinks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {analysis.timeSinks.length} question
                {analysis.timeSinks.length !== 1 ? 's' : ''} took too long
              </h4>
            </div>
            <ul className="space-y-1 pl-6">
              {analysis.timeSinks.map((sink) => (
                <li
                  key={sink.questionId}
                  className="text-sm text-gray-600 dark:text-gray-300"
                >
                  <span className="font-medium">Q{sink.questionId}</span>
                  {' '}spent {sink.timeSpentSeconds}s (threshold: {sink.thresholdSeconds}s)
                  {' '}&mdash;{' '}
                  <span
                    className={
                      sink.isCorrect ? 'text-green-600' : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {sink.isCorrect ? 'correct' : 'wrong'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rush warnings */}
        {analysis.rushWarnings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {analysis.rushWarnings.length} question
                {analysis.rushWarnings.length !== 1 ? 's' : ''} were rushed
              </h4>
            </div>
            <ul className="space-y-1 pl-6">
              {analysis.rushWarnings.map((warning) => (
                <li
                  key={warning.questionId}
                  className="text-sm text-gray-600 dark:text-gray-300"
                >
                  <span className="font-medium">Q{warning.questionId}</span>
                  {' '}spent only {warning.timeSpentSeconds}s &mdash;{' '}
                  <span
                    className={
                      warning.isCorrect ? 'text-green-600' : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {warning.isCorrect ? 'correct' : 'wrong'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recommendations
            </h4>
            <ul className="list-disc space-y-1 pl-6">
              {analysis.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
