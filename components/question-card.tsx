'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  questionText: string;
  passageText: string | null;
  subSkillId: string;
  difficulty: number;
  questionNumber: number;
  totalQuestions?: number;
}

export function QuestionCard({
  questionText,
  passageText,
  subSkillId,
  difficulty,
  questionNumber,
  totalQuestions,
}: QuestionCardProps) {
  const maxDifficulty = 5;
  const filledDots = Math.min(Math.max(difficulty, 0), maxDifficulty);
  const unfilledDots = maxDifficulty - filledDots;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Question {questionNumber}
            {totalQuestions != null && (
              <span className="text-muted-foreground font-normal">
                {' '}
                of {totalQuestions}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{subSkillId}</Badge>
            <div className="flex items-center gap-1" title={`Difficulty: ${difficulty}/${maxDifficulty}`}>
              {Array.from({ length: filledDots }).map((_, i) => (
                <span
                  key={`filled-${i}`}
                  className="inline-block h-2 w-2 rounded-full bg-blue-600"
                />
              ))}
              {Array.from({ length: unfilledDots }).map((_, i) => (
                <span
                  key={`unfilled-${i}`}
                  className="inline-block h-2 w-2 rounded-full bg-gray-200"
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {passageText && (
          <div className="mb-4 max-h-60 overflow-y-auto rounded border-l-4 border-blue-200 bg-slate-50 p-4 text-sm italic text-gray-700">
            {passageText}
          </div>
        )}
        <p className="text-lg font-medium">{questionText}</p>
      </CardContent>
    </Card>
  );
}
