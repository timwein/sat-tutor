'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnswerChoicesProps {
  choices: Record<string, string>;
  selectedAnswer: string | null;
  onSelect: (answer: string) => void;
  crossedOut: Set<string>;
  onToggleCrossOut: (answer: string) => void;
  disabled: boolean;
  correctAnswer?: string;
  showResult: boolean;
}

export function AnswerChoices({
  choices,
  selectedAnswer,
  onSelect,
  crossedOut,
  onToggleCrossOut,
  disabled,
  correctAnswer,
  showResult,
}: AnswerChoicesProps) {
  const sortedKeys = Object.keys(choices).sort();

  return (
    <div className="flex flex-col gap-3">
      {sortedKeys.map((letter) => {
        const text = choices[letter];
        const isSelected = selectedAnswer === letter;
        const isCrossedOut = crossedOut.has(letter);
        const isCorrect = showResult && letter === correctAnswer;
        const isWrongSelected = showResult && isSelected && letter !== correctAnswer;

        return (
          <div key={letter} className="group relative flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(letter)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-3.5 text-left transition-colors md:px-4 md:py-3',
                'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                isSelected && !showResult && 'border-blue-500 bg-blue-50 dark:bg-blue-950/40',
                isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950/40',
                isWrongSelected && 'border-red-500 bg-red-50 dark:bg-red-950/40',
                isCrossedOut && 'opacity-50',
                disabled && 'cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm',
                  'border bg-white dark:bg-gray-900',
                  isSelected && !showResult && 'border-blue-500 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
                  isCorrect && 'border-green-500 bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300',
                  isWrongSelected && 'border-red-500 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300',
                  !isSelected && !isCorrect && !isWrongSelected && 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                )}
              >
                {letter}
              </span>
              <span
                className={cn(
                  'flex-1 text-sm',
                  isCrossedOut && 'line-through text-gray-400 dark:text-gray-500'
                )}
              >
                {text}
              </span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCrossOut(letter);
              }}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 md:h-6 md:w-6',
                isCrossedOut
                  ? 'opacity-100'
                  : 'opacity-100 md:opacity-0 md:group-hover:opacity-100',
                disabled && 'pointer-events-none'
              )}
              title={isCrossedOut ? 'Undo cross out' : 'Cross out'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
