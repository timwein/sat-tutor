'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { StreakData } from '@/lib/streak-calculator';

interface StreakDisplayProps {
  streak: StreakData;
}

const MILESTONES = [
  { days: 7, label: '7 days', style: 'bg-orange-100 text-orange-700 border-orange-300' },
  { days: 14, label: '14 days', style: 'bg-gray-200 text-gray-700 dark:text-gray-300 border-gray-400' },
  { days: 30, label: '30 days', style: 'bg-yellow-100 text-yellow-700 border-yellow-400' },
  { days: 60, label: '60 days', style: 'bg-emerald-100 text-emerald-700 border-emerald-400' },
  { days: 90, label: '90 days', style: 'bg-purple-100 text-purple-700 border-purple-400' },
] as const;

export function StreakDisplay({ streak }: StreakDisplayProps) {
  const hasStreak = streak.currentStreak > 0;

  const earnedMilestones = MILESTONES.filter(
    (m) => streak.currentStreak >= m.days || streak.longestStreak >= m.days
  );

  return (
    <div className="space-y-4">
      {/* Main streak display */}
      <div className="flex items-center gap-3">
        <Flame
          className={cn(
            'h-10 w-10',
            hasStreak ? 'text-orange-500' : 'text-muted-foreground/40'
          )}
        />
        <div>
          {hasStreak ? (
            <p className="text-3xl font-bold">
              {streak.currentStreak}{' '}
              <span className="text-lg font-medium text-muted-foreground">
                day{streak.currentStreak !== 1 ? 's' : ''}
              </span>
            </p>
          ) : (
            <p className="text-lg font-medium text-muted-foreground">
              Start your streak!
            </p>
          )}
        </div>
      </div>

      {/* Milestone badges */}
      {earnedMilestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {earnedMilestones.map((m) => {
            const isJustReached = streak.milestoneReached === m.days;
            return (
              <Badge
                key={m.days}
                variant="outline"
                className={cn(
                  m.style,
                  isJustReached && 'animate-pulse ring-2 ring-offset-1 ring-current'
                )}
              >
                {m.label}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Longest streak line */}
      <p className="text-sm text-muted-foreground">
        Longest streak: {streak.longestStreak} day{streak.longestStreak !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
