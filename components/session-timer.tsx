'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PHASE_LABELS } from '@/lib/session-manager';
import type { SessionPhase } from '@/lib/types';

interface SessionTimerProps {
  startedAt: string;
  maxMinutes: number;
  questionsAnswered: number;
  questionsCorrect: number;
  maxQuestions: number;
  sessionPhase: SessionPhase;
  onEndSession: () => void;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function SessionTimer({
  startedAt,
  maxMinutes,
  questionsAnswered,
  questionsCorrect,
  maxQuestions,
  sessionPhase,
  onEndSession,
}: SessionTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();

    function tick() {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const progressPercent =
    maxQuestions > 0 ? (questionsAnswered / maxQuestions) * 100 : 0;

  const accuracy =
    questionsAnswered > 0
      ? Math.round((questionsCorrect / questionsAnswered) * 100)
      : null;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const isOverTime = elapsedMinutes >= maxMinutes;

  return (
    <div className="flex items-center justify-between border-b bg-white px-6 py-3">
      {/* Left: Timer */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-gray-500" />
        <span className={isOverTime ? 'font-medium text-red-600' : 'text-gray-700'}>
          {formatElapsed(elapsedSeconds)}
        </span>
        <span className="text-gray-400">/ {maxMinutes}:00</span>
      </div>

      {/* Center: Progress */}
      <div className="flex flex-1 items-center gap-3 px-8">
        <Progress value={progressPercent} className="flex-1" />
        <span className="whitespace-nowrap text-sm text-gray-600">
          {questionsAnswered} / {maxQuestions} questions
        </span>
      </div>

      {/* Right: Accuracy, Phase, End button */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          Accuracy:{' '}
          <span className="font-medium">
            {accuracy != null ? `${accuracy}%` : '--'}
          </span>
        </span>
        <Badge variant="secondary">{PHASE_LABELS[sessionPhase]}</Badge>
        <Button variant="outline" size="sm" onClick={onEndSession}>
          End Session
        </Button>
      </div>
    </div>
  );
}
