'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee, Trophy } from 'lucide-react';
import { TimedSection } from '@/components/timed-section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FULL_TEST_SEQUENCE,
  getModuleById,
  biasFromModule1Accuracy,
  type FullTestStageResult,
} from '@/lib/practice-test-config';
import type { ModuleResult } from '@/lib/types';

interface FullTestClientProps {
  sessionId: string;
  studentId: string;
  stageIndex: number;
  stageResults: FullTestStageResult[];
  breakUntil: string | null;
  remainingSeconds: number;
  protocolReminder?: string | null;
}

function toStageResult(result: ModuleResult): FullTestStageResult {
  return {
    module_id: result.moduleId,
    correct: result.totalCorrect,
    total: result.totalQuestions,
    accuracy: result.accuracy,
    time_used_seconds: result.totalTimeUsedSeconds,
  };
}

/** Estimated 200-800 section score from module accuracy (rounded to 10). */
function estimateSectionScore(results: FullTestStageResult[], prefix: string): number | null {
  const modules = results.filter((r) => r.module_id.startsWith(prefix));
  const total = modules.reduce((s, m) => s + m.total, 0);
  const correct = modules.reduce((s, m) => s + m.correct, 0);
  if (total === 0) return null;
  return Math.round((200 + (correct / total) * 600) / 10) * 10;
}

export function FullTestClient({
  sessionId,
  studentId,
  stageIndex,
  stageResults,
  breakUntil,
  remainingSeconds,
  protocolReminder,
}: FullTestClientProps) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [finalResults, setFinalResults] = useState<FullTestStageResult[] | null>(null);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number>(() =>
    breakUntil ? Math.max(0, Math.floor((new Date(breakUntil).getTime() - Date.now()) / 1000)) : 0
  );

  const stage = FULL_TEST_SEQUENCE[stageIndex];
  const isLastStage = stageIndex === FULL_TEST_SEQUENCE.length - 1;

  // Break countdown
  useEffect(() => {
    if (!breakUntil || stage?.kind !== 'break') return;
    const interval = setInterval(() => {
      setBreakSecondsLeft(
        Math.max(0, Math.floor((new Date(breakUntil).getTime() - Date.now()) / 1000))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [breakUntil, stage]);

  async function advance(stageResult?: FullTestStageResult) {
    setAdvancing(true);
    try {
      await fetch('/api/practice-test/advance-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          session_id: sessionId,
          stage_result: stageResult,
        }),
      });
    } finally {
      setAdvancing(false);
      router.refresh();
    }
  }

  async function handleModuleComplete(result: ModuleResult) {
    const summary = toStageResult(result);
    if (isLastStage) {
      // Session is already ended (is_final submit); record + show the report.
      const all = [...stageResults, summary];
      setFinalResults(all);
      fetch('/api/practice-test/advance-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, session_id: sessionId, stage_result: summary }),
      }).catch(() => {});
    } else {
      await advance(summary);
    }
  }

  // ---- Final score report ----
  if (finalResults) {
    const rw = estimateSectionScore(finalResults, 'rw');
    const math = estimateSectionScore(finalResults, 'math');
    const total = rw !== null && math !== null ? rw + math : null;
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Trophy className="h-10 w-10 text-amber-500" />
          <h1 className="text-2xl font-bold">Practice Test Complete</h1>
          <p className="text-gray-500 dark:text-gray-400">Full-length digital SAT simulation finished.</p>
        </div>

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/40">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Estimated Score</p>
            <p className="text-5xl font-bold text-blue-900">{total ?? '--'}</p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              R/W: {rw ?? '--'} · Math: {math ?? '--'}
            </p>
            <p className="mt-2 text-xs text-blue-600">
              Estimate based on raw accuracy - official scoring uses equated scales.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {finalResults.map((r) => {
              const def = getModuleById(r.module_id);
              return (
                <div
                  key={r.module_id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
                >
                  <span className="font-medium">{def?.label ?? r.module_id}</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {r.correct}/{r.total} · {Math.round(r.accuracy * 100)}% ·{' '}
                    {Math.round(r.time_used_seconds / 60)} min
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => router.push('/practice-test')}>
          Back to Practice Tests
        </Button>
      </div>
    );
  }

  if (!stage) {
    router.push('/practice-test');
    return null;
  }

  // ---- Break screen ----
  if (stage.kind === 'break') {
    const minutes = Math.floor(breakSecondsLeft / 60);
    const seconds = breakSecondsLeft % 60;
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Coffee className="h-5 w-5 text-amber-600" />
              Break Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-5xl font-bold tabular-nums">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Reading &amp; Writing is done. Stand up, stretch, get water - just like
              the real test&apos;s 10-minute break. Math starts next.
            </p>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-left text-xs text-gray-500 dark:text-gray-400">
              Completed so far:{' '}
              {stageResults.map((r) => `${getModuleById(r.module_id)?.label}: ${r.correct}/${r.total}`).join(' · ')}
            </div>
            <Button
              className="w-full"
              onClick={() => advance()}
              disabled={advancing}
            >
              {breakSecondsLeft > 0
                ? advancing
                  ? 'Starting...'
                  : 'Skip Break - Start Math'
                : advancing
                  ? 'Starting...'
                  : 'Start Math Section'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Module stage ----
  const moduleDef = getModuleById(stage.moduleId);
  if (!moduleDef) return null;

  // Adaptive module 2: difficulty follows module 1 of the same section
  let difficultyBias: 'harder' | 'easier' | undefined;
  if (moduleDef.adaptive) {
    const prefix = stage.moduleId.startsWith('rw') ? 'rw' : 'math';
    const module1 = stageResults.find((r) => r.module_id === `${prefix}-module-1`);
    if (module1 && module1.total > 0) {
      difficultyBias = biasFromModule1Accuracy(module1.correct / module1.total);
    }
  }

  const moduleNumber = stageIndex >= 3 ? stageIndex - 1 : stageIndex + 1;

  return (
    <div className="space-y-2">
      <p className="px-4 pt-3 text-center text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Full Practice Test · Stage {moduleNumber} of 4 · {moduleDef.label}
      </p>
      {protocolReminder && moduleDef.section === 'reading_writing' && (
        <p className="mx-4 rounded-md bg-blue-50 px-3 py-1.5 text-center text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {protocolReminder}
        </p>
      )}
      <TimedSection
        key={stage.moduleId}
        sessionId={sessionId}
        studentId={studentId}
        moduleId={moduleDef.id}
        section={moduleDef.section}
        timeLimitSeconds={remainingSeconds}
        calculatorAllowed={moduleDef.calculatorAllowed}
        onComplete={handleModuleComplete}
        difficultyBias={difficultyBias}
        isFinalModule={isLastStage}
      />
    </div>
  );
}
