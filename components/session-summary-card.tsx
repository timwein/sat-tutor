'use client';

import Link from 'next/link';
import {
  Trophy,
  ArrowUp,
  ArrowDown,
  Clock,
  Target,
  CheckCircle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Session, EloUpdate, MasteryLevel } from '@/lib/types';

interface SessionSummaryCardProps {
  session: Session;
  summary: string;
  eloChanges: EloUpdate[];
}

const MASTERY_COLORS: Record<MasteryLevel, string> = {
  Developing: 'bg-red-100 text-red-700',
  Progressing: 'bg-amber-100 text-amber-700',
  Proficient: 'bg-blue-100 text-blue-700',
  Mastered: 'bg-green-100 text-green-700',
};

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '--';
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const totalSeconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function SessionSummaryCard({
  session,
  summary,
  eloChanges,
}: SessionSummaryCardProps) {
  const accuracy =
    session.questions_answered > 0
      ? Math.round(
          (session.questions_correct / session.questions_answered) * 100
        )
      : 0;

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-500" />
          <CardTitle className="text-xl">Session Complete</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3 md:p-4">
            <Clock className="mb-1 h-4 w-4 text-gray-500 md:h-5 md:w-5" />
            <span className="text-sm font-semibold md:text-lg">
              {formatDuration(session.started_at, session.ended_at)}
            </span>
            <span className="text-xs text-gray-500">Duration</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3 md:p-4">
            <Target className="mb-1 h-4 w-4 text-gray-500 md:h-5 md:w-5" />
            <span className="text-sm font-semibold md:text-lg">
              {session.questions_correct} / {session.questions_answered}
            </span>
            <span className="text-xs text-gray-500">Questions</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-gray-50 p-3 md:p-4">
            <CheckCircle className="mb-1 h-4 w-4 text-gray-500 md:h-5 md:w-5" />
            <span className="text-sm font-semibold md:text-lg">{accuracy}%</span>
            <span className="text-xs text-gray-500">Accuracy</span>
          </div>
        </div>

        <Separator />

        {/* Claude's summary */}
        <p className="leading-relaxed text-gray-700">{summary}</p>

        <Separator />

        {/* Elo changes list */}
        {eloChanges.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Skill Rating Changes
            </h3>
            <div className="space-y-2">
              {eloChanges.map((change) => (
                <div
                  key={change.sub_skill_id}
                  className="flex items-center justify-between rounded-lg border px-4 py-2"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {change.sub_skill_name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex items-center gap-1 text-sm font-semibold',
                        change.delta > 0 && 'text-green-600',
                        change.delta < 0 && 'text-red-600',
                        change.delta === 0 && 'text-gray-500'
                      )}
                    >
                      {change.delta > 0 && (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                      {change.delta < 0 && (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                      {change.delta > 0 ? '+' : ''}
                      {change.delta}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(MASTERY_COLORS[change.mastery_level])}
                    >
                      {change.mastery_level}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/">Back to Dashboard</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/study">Start Another Session</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
