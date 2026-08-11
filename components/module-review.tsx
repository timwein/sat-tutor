'use client';

import { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PacingChart } from './pacing-chart';
import { PacingSummary } from './pacing-summary';
import { AddWordInline } from './add-word-inline';
import { cn } from '@/lib/utils';
import type { ModuleResult, MasteryLevel } from '@/lib/types';

interface ModuleReviewProps {
  result: ModuleResult;
  onBack: () => void;
  studentId?: string;
}

const MASTERY_COLORS: Record<MasteryLevel, string> = {
  Developing: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300',
  Progressing: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
  Proficient: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
  Mastered: 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300',
};

const SECTION_LABELS: Record<string, string> = {
  math: 'Math',
  reading_writing: 'Reading & Writing',
};

export function ModuleReview({ result, onBack, studentId }: ModuleReviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const thresholdSeconds = result.section === 'math' ? 90 : 75;
  const accuracyPercent = Math.round(result.accuracy * 100);

  function toggleExpanded(index: number) {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                {SECTION_LABELS[result.section] ?? result.section} &mdash;{' '}
                {result.moduleId}
              </CardTitle>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {result.totalCorrect} of {result.totalQuestions} correct &middot;{' '}
                {Math.round(result.totalTimeUsedSeconds / 60)}m{' '}
                {result.totalTimeUsedSeconds % 60}s used of{' '}
                {Math.round(result.timeLimitSeconds / 60)}m
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  'text-4xl font-bold',
                  accuracyPercent >= 80
                    ? 'text-green-600'
                    : accuracyPercent >= 60
                      ? 'text-amber-600'
                      : 'text-red-600 dark:text-red-400'
                )}
              >
                {accuracyPercent}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Elo Changes Summary */}
      {result.eloUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skill Rating Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.eloUpdates.map((update) => (
              <div
                key={update.sub_skill_id}
                className="flex items-center justify-between rounded-lg border px-4 py-2"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {update.sub_skill_name}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex items-center gap-1 text-sm font-semibold',
                      update.delta > 0 && 'text-green-600',
                      update.delta < 0 && 'text-red-600 dark:text-red-400',
                      update.delta === 0 && 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {update.delta > 0 && <ArrowUp className="h-3.5 w-3.5" />}
                    {update.delta < 0 && <ArrowDown className="h-3.5 w-3.5" />}
                    {update.delta > 0 ? '+' : ''}
                    {update.delta}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(MASTERY_COLORS[update.mastery_level])}
                  >
                    {update.mastery_level}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pacing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pacing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PacingChart
            results={result.questionResults}
            thresholdSeconds={thresholdSeconds}
          />
        </CardContent>
      </Card>

      <PacingSummary analysis={result.pacingAnalysis} />

      {/* Question Results List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] space-y-2 overflow-y-auto">
            {result.questionResults.map((qr, index) => {
              const isExpanded = expandedIndex === index;

              return (
                <div
                  key={qr.questionId}
                  className="rounded-lg border"
                >
                  {/* Collapsed row */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(index)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <span className="w-8 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                      {index + 1}
                    </span>

                    {qr.isCorrect ? (
                      <Badge className="gap-1 bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300">
                        <Check className="h-3 w-3" />
                        Correct
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                        <X className="h-3 w-3" />
                        Wrong
                      </Badge>
                    )}

                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {qr.timeSpentSeconds}s
                    </span>

                    <span className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      {!qr.isCorrect && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {qr.studentAnswer ?? 'No answer'} &rarr;{' '}
                          {qr.correctAnswer}
                        </span>
                      )}
                      {!qr.isCorrect && qr.errorClassification && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                        >
                          {qr.errorClassification.error_type}
                        </Badge>
                      )}
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3">
                      <div className="space-y-3">
                        {/* Question text */}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            Question
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                            {qr.question.question_text}
                          </p>
                        </div>

                        {/* Answer details */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Your Answer
                            </p>
                            <p
                              className={cn(
                                'mt-1 text-sm font-medium',
                                qr.isCorrect
                                  ? 'text-green-600'
                                  : 'text-red-600 dark:text-red-400'
                              )}
                            >
                              {qr.studentAnswer ?? 'No answer'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              Correct Answer
                            </p>
                            <p className="mt-1 text-sm font-medium text-green-600">
                              {qr.correctAnswer}
                            </p>
                          </div>
                        </div>

                        {/* Confidence & time */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          {qr.confidenceLevel && (
                            <span>
                              Confidence:{' '}
                              <span className="font-medium capitalize">
                                {qr.confidenceLevel}
                              </span>
                            </span>
                          )}
                          <span>Time: {qr.timeSpentSeconds}s</span>
                        </div>

                        {/* Bank a word from this question (R/W only) */}
                        {studentId && result.section === 'reading_writing' && (
                          <AddWordInline
                            studentId={studentId}
                            suggestedWord={
                              qr.question.sub_skill_id === 'RW-05' &&
                              /^[A-Za-z][A-Za-z' -]*$/.test(qr.correctAnswer ?? '') &&
                              (qr.correctAnswer ?? '').split(/\s+/).length <= 2
                                ? qr.correctAnswer
                                : undefined
                            }
                            contextSentence={qr.question.passage_text?.slice(0, 400) ?? qr.question.question_text.slice(0, 400)}
                            sourceQuestionId={qr.question.question_id}
                            sourceLabel="From a practice test"
                          />
                        )}

                        {/* Error explanation */}
                        {!qr.isCorrect && qr.errorClassification && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                                >
                                  {qr.errorClassification.error_type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {qr.errorClassification.distractor_type}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {qr.errorClassification.explanation}
                              </p>
                              <p className="text-sm italic text-gray-500 dark:text-gray-400">
                                What you likely thought:{' '}
                                {qr.errorClassification.what_student_likely_thought}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-center pb-8">
        <Button variant="outline" onClick={onBack} size="lg">
          Back to Practice Tests
        </Button>
      </div>
    </div>
  );
}
