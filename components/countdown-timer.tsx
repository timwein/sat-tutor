'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  isPaused?: boolean;
  currentQuestion?: number;
  totalQuestions?: number;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownTimer({
  totalSeconds,
  onTimeUp,
  isPaused = false,
  currentQuestion,
  totalQuestions,
}: CountdownTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (isPaused || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, secondsRemaining]);

  useEffect(() => {
    if (secondsRemaining === 0) {
      onTimeUp();
    }
  }, [secondsRemaining, onTimeUp]);

  const isWarning = secondsRemaining <= 300 && secondsRemaining > 60;
  const isCritical = secondsRemaining <= 60;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <Clock
          className={cn(
            'h-5 w-5',
            isCritical ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'
          )}
        />
        <span
          className={cn(
            'font-mono text-lg font-semibold tabular-nums',
            isCritical && 'animate-pulse text-red-600 dark:text-red-400',
            isWarning && !isCritical && 'text-orange-500',
            !isWarning && !isCritical && 'text-gray-700 dark:text-gray-300'
          )}
        >
          {formatTime(secondsRemaining)}
        </span>
      </div>
      {currentQuestion != null && totalQuestions != null && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {currentQuestion} / {totalQuestions}
        </span>
      )}
    </div>
  );
}
