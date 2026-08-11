'use client';

import { HelpCircle, Minus, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfidenceSelectorProps {
  selected: 'guessing' | 'okay' | 'confident' | null;
  onSelect: (level: 'guessing' | 'okay' | 'confident') => void;
  disabled: boolean;
}

const levels = [
  {
    value: 'guessing' as const,
    label: 'Guessing',
    icon: HelpCircle,
    selectedClasses: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60',
  },
  {
    value: 'okay' as const,
    label: 'Okay',
    icon: Minus,
    selectedClasses: 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/60',
  },
  {
    value: 'confident' as const,
    label: 'Confident',
    icon: CheckCircle,
    selectedClasses: 'border-green-500 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/60',
  },
];

export function ConfidenceSelector({
  selected,
  onSelect,
  disabled,
}: ConfidenceSelectorProps) {
  return (
    <div>
      <div className="mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          How confident are you?
        </span>{' '}
        <span className="text-xs text-gray-400 dark:text-gray-500">(optional)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {levels.map((level) => {
          const isSelected = selected === level.value;
          const Icon = level.icon;

          return (
            <Button
              key={level.value}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onSelect(level.value)}
              className={cn(
                'h-11 gap-1.5 text-xs md:h-9 md:gap-2 md:text-sm',
                isSelected && level.selectedClasses
              )}
            >
              <Icon className="h-4 w-4" />
              {level.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
