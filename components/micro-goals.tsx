'use client';

import type { MicroGoalData } from '@/lib/micro-goals';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Timer,
  ShieldCheck,
  Target,
  Flame,
  RotateCcw,
  Check,
} from 'lucide-react';

interface MicroGoalsProps {
  goals: MicroGoalData[];
}

const GOAL_ICONS: Record<string, typeof Trophy> = {
  master_skills: Trophy,
  complete_drills: Timer,
  reduce_errors: ShieldCheck,
  accuracy_target: Target,
  study_streak: Flame,
  review_queue: RotateCcw,
};

const GOAL_COLORS: Record<string, string> = {
  master_skills: 'text-yellow-600',
  complete_drills: 'text-purple-600',
  reduce_errors: 'text-red-500',
  accuracy_target: 'text-blue-600',
  study_streak: 'text-orange-500',
  review_queue: 'text-green-600',
};

export function MicroGoals({ goals }: MicroGoalsProps) {
  if (goals.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">This Week&apos;s Goals</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {goals.map((goal) => {
          const Icon = GOAL_ICONS[goal.goalType] ?? Target;
          const color = GOAL_COLORS[goal.goalType] ?? 'text-gray-600 dark:text-gray-300';

          // For "lower is better" goals, invert the progress
          const isLowerBetter =
            goal.goalType === 'reduce_errors' || goal.goalType === 'review_queue';

          let progressPercent: number;
          let label: string;

          if (isLowerBetter) {
            // Progress fills as current approaches (or goes below) target
            const startValue = goal.targetValue * 2; // reasonable upper bound
            progressPercent =
              startValue > 0
                ? Math.min(100, Math.max(0, ((startValue - goal.currentValue) / startValue) * 100))
                : goal.isCompleted ? 100 : 0;
            label = `${goal.currentValue} remaining`;
          } else {
            progressPercent =
              goal.targetValue > 0
                ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
                : 0;
            label = `${goal.currentValue} / ${goal.targetValue}`;
          }

          return (
            <Card key={goal.id} className={goal.isCompleted ? 'border-green-200 bg-green-50 dark:bg-green-950/40' : ''}>
              <CardContent className="flex items-start gap-3 pt-4">
                <div className="mt-0.5">
                  <Icon className={`h-5 w-5 ${goal.isCompleted ? 'text-green-600' : color}`} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{goal.title}</span>
                    {goal.isCompleted && (
                      <Badge
                        variant="outline"
                        className="border-green-300 bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300"
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Done
                      </Badge>
                    )}
                  </div>
                  <Progress
                    value={goal.isCompleted ? 100 : progressPercent}
                    className="h-2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
