'use client';

import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  onNavigate: (index: number) => void;
  answeredSet: Set<number>;
  flaggedSet: Set<number>;
}

export function QuestionNavigator({
  totalQuestions,
  currentIndex,
  onNavigate,
  answeredSet,
  flaggedSet,
}: QuestionNavigatorProps) {
  const answeredCount = answeredSet.size;
  const flaggedCount = flaggedSet.size;
  const remainingCount = totalQuestions - answeredCount;

  const firstFlaggedIndex = Array.from(flaggedSet).sort((a, b) => a - b)[0];

  const gridCols = totalQuestions > 25 ? 'grid-cols-6' : 'grid-cols-5';

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid gap-2', gridCols)}>
        {Array.from({ length: totalQuestions }, (_, i) => {
          const isAnswered = answeredSet.has(i);
          const isFlagged = flaggedSet.has(i);
          const isCurrent = i === currentIndex;

          return (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => onNavigate(i)}
              className={cn(
                'h-9 w-9 p-0 text-xs font-medium',
                isAnswered && 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                !isAnswered && 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                isFlagged && 'border-orange-400 border-2',
                isCurrent && 'ring-2 ring-blue-500 ring-offset-1'
              )}
            >
              {i + 1}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          {answeredCount} answered, {flaggedCount} flagged, {remainingCount} remaining
        </span>
      </div>

      {flaggedCount > 0 && firstFlaggedIndex != null && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(firstFlaggedIndex)}
          className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50"
        >
          <Flag className="h-3.5 w-3.5" />
          Review Flagged
        </Button>
      )}
    </div>
  );
}
