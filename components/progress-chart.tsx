'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScorePrediction } from '@/lib/types';

interface ProgressChartProps {
  predictions: ScorePrediction[];
}

/** Predicted-score trend over time, with the low-high range as a band. */
export function ProgressChart({ predictions }: ProgressChartProps) {
  if (predictions.length < 2) return null;

  const data = predictions.map((p) => ({
    date: new Date(p.predicted_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    score: p.total_score_mid,
    // Area band: [low, high] rendered via stacked trick using range key
    range: [p.total_score_low, p.total_score_high],
    rw: p.rw_score,
    math: p.math_score,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[400, 1600]} tick={{ fontSize: 11 }} tickCount={7} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any) => {
                  if (name === 'range' && Array.isArray(value)) {
                    return [`${value[0]} - ${value[1]}`, 'Range'];
                  }
                  const label =
                    name === 'score' ? 'Predicted' : name === 'rw' ? 'R/W (of 800)' : 'Math (of 800)';
                  return [value ?? '', label];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any}
              />
              <Area
                dataKey="range"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Predicted total score after each session, with the estimated range shaded.
        </p>
      </CardContent>
    </Card>
  );
}
