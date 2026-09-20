'use client';

import { cn } from '@/lib/utils';
import {
  GRID_IN_MAX_LENGTH,
  formatAcceptedAnswers,
  isAnswerCorrect,
  sanitizeGridInInput,
} from '@/lib/answer-format';

interface GridInAnswerProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  correctAnswer?: string;
  showResult: boolean;
}

/**
 * Input for SAT student-produced response ("grid-in") questions, which have
 * no answer choices. Accepts digits, a decimal point, a fraction slash and a
 * leading minus sign, mirroring what the real answer grid allows.
 */
export function GridInAnswer({
  value,
  onChange,
  disabled,
  correctAnswer,
  showResult,
}: GridInAnswerProps) {
  const graded = showResult && typeof correctAnswer === 'string';
  const correct =
    graded && isAnswerCorrect({ answer_choices: {}, correct_answer: correctAnswer }, value);

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="grid-in-answer"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Your answer
      </label>
      <input
        id="grid-in-answer"
        type="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={GRID_IN_MAX_LENGTH}
        value={value}
        disabled={disabled}
        placeholder="e.g. 12, -3.5 or 7/4"
        onChange={(e) => onChange(sanitizeGridInInput(e.target.value))}
        className={cn(
          'w-full max-w-xs rounded-lg border bg-white px-4 py-3 font-mono text-lg tracking-wide dark:bg-gray-900',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          !graded && 'border-gray-300 dark:border-gray-700',
          graded && correct && 'border-green-500 bg-green-50 dark:bg-green-950/40',
          graded && !correct && 'border-red-500 bg-red-50 dark:bg-red-950/40',
          disabled && 'cursor-not-allowed opacity-80'
        )}
      />
      {graded ? (
        <p
          className={cn(
            'text-sm',
            correct ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
          )}
        >
          {correct ? 'Correct.' : `Correct answer: ${formatAcceptedAnswers(correctAnswer)}`}
        </p>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Type a number. Decimals and fractions both work (0.5 or 1/2). No mixed numbers, no
          units.
        </p>
      )}
    </div>
  );
}
