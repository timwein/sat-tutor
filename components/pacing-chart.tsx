'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { QuestionResult } from '@/lib/types';

interface PacingChartProps {
  results: QuestionResult[];
  thresholdSeconds: number;
}

interface ChartDataPoint {
  questionNumber: number;
  timeSpentSeconds: number;
  isCorrect: boolean;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
      <p className="text-sm font-medium">
        Question {data.questionNumber}: {data.timeSpentSeconds}s
      </p>
      <p
        className={`text-xs ${data.isCorrect ? 'text-green-600' : 'text-red-600'}`}
      >
        {data.isCorrect ? 'Correct' : 'Wrong'}
      </p>
    </div>
  );
}

export function PacingChart({ results, thresholdSeconds }: PacingChartProps) {
  const chartData: ChartDataPoint[] = results.map((result, index) => ({
    questionNumber: index + 1,
    timeSpentSeconds: result.timeSpentSeconds,
    isCorrect: result.isCorrect,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis
          dataKey="questionNumber"
          label={{ value: 'Question', position: 'insideBottom', offset: -5 }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          label={{
            value: 'Time (s)',
            angle: -90,
            position: 'insideLeft',
            offset: 10,
          }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={thresholdSeconds}
          stroke="#f59e0b"
          strokeDasharray="6 3"
          label={{
            value: 'Time Sink Threshold',
            position: 'right',
            fill: '#f59e0b',
            fontSize: 12,
          }}
        />
        <Bar dataKey="timeSpentSeconds" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isCorrect ? '#22c55e' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
