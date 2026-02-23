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
                'bg-white hover:bg-gray-50',
                isSelected && !showResult && 'border-blue-500 bg-blue-50',
                isCorrect && 'border-green-500 bg-green-50',
                isWrongSelected && 'border-red-500 bg-red-50',
                isCrossedOut && 'opacity-50',
                disabled && 'cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-sm',
                  'border bg-white',
                  isSelected && !showResult && 'border-blue-500 bg-blue-100 text-blue-700',
                  isCorrect && 'border-green-500 bg-green-100 text-green-700',
                  isWrongSelected && 'border-red-500 bg-red-100 text-red-700',
                  !isSelected && !isCorrect && !isWrongSelected && 'border-gray-300 text-gray-600'
                )}
              >
                {letter}
              </span>
              <span
                className={cn(
                  'flex-1 text-sm',
                  isCrossedOut && 'line-through text-gray-400'
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
                'flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-600 md:h-6 md:w-6',
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
