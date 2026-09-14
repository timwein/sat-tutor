'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FlaskConical, Loader2, Trophy } from 'lucide-react';
import { ApiKeyNotice } from '@/components/api-key-notice';
import { readApiError, apiErrorMessage, isApiKeyError } from '@/lib/api-errors';
import {
  DRILLS_PER_ARM,
  EXPERIMENT_ARMS,
  summarizeArms,
  type ArmsState,
  type ArmSummary,
} from '@/lib/strategy-experiments';

interface ExperimentRow {
  id: string;
  status: 'running' | 'paused' | 'concluded';
  arms: ArmsState;
  conclusion: {
    winner: string;
    winner_name: string;
    verdict: string;
    arm_summaries: ArmSummary[];
  } | null;
}

interface ExperimentPanelProps {
  studentId: string;
  experiment: ExperimentRow | null;
}

/** Error from an API response ({ error, code }); key problems render ApiKeyNotice. */
interface ApiError {
  code?: string;
  message: string;
}

export function ExperimentPanel({ studentId, experiment }: ExperimentPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, action: 'enroll' }),
      });
      if (!res.ok) {
        const body = await readApiError(res);
        setError({
          code: body.code,
          message: apiErrorMessage(body, 'Failed to start the experiment'),
        });
        return;
      }
      router.refresh();
    } catch {
      setError({ message: 'Failed to start' });
    } finally {
      setBusy(false);
    }
  }

  async function startDrill() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, action: 'start_drill' }),
      });
      if (!res.ok) {
        const body = await readApiError(res);
        setError({ code: body.code, message: apiErrorMessage(body, 'Failed to start drill') });
        setBusy(false);
        return;
      }
      const data = await res.json();
      router.push(`/study/${data.session_id}`);
    } catch {
      setError({ message: 'Failed to start drill' });
      setBusy(false);
    }
  }

  // ---- Concluded: the verdict ----
  if (experiment?.status === 'concluded' && experiment.conclusion) {
    const c = experiment.conclusion;
    return (
      <Card data-testid="experiment-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" /> Your Reading Protocol
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
              Winner: {c.winner_name}
            </Badge>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{c.verdict}</p>
          <div className="space-y-1.5">
            {c.arm_summaries.map((s) => (
              <div
                key={s.tag}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm dark:border-gray-700 ${s.tag === c.winner ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : ''}`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {s.accuracy !== null ? `${Math.round(s.accuracy * 100)}%` : '--'} ·{' '}
                  {s.median_seconds_per_question ?? '--'}s/q · {s.questions} questions
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            The winning protocol&apos;s reminder now shows before every Reading &amp; Writing
            timed section.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Running: progress + next drill ----
  if (experiment?.status === 'running') {
    const summaries = summarizeArms(experiment.arms ?? {});
    const totalDrills = summaries.reduce((s, a) => s + a.drills, 0);
    const targetDrills = DRILLS_PER_ARM * EXPERIMENT_ARMS.length;
    return (
      <Card data-testid="experiment-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-blue-600" /> Reading Strategy Experiment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalDrills} of {targetDrills} drills done. Each drill assigns one of
            three reading protocols; results compare once every protocol has {DRILLS_PER_ARM}.
          </p>
          <div className="space-y-1.5">
            {summaries.map((s) => (
              <div key={s.tag} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm dark:border-gray-700">
                <span className="font-medium">{s.name}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {s.drills}/{DRILLS_PER_ARM} drills
                  {s.accuracy !== null ? ` · ${Math.round(s.accuracy * 100)}%` : ''}
                </span>
              </div>
            ))}
          </div>
          <Button onClick={startDrill} disabled={busy} className="w-full">
            {busy ? (
              <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Starting...</>
            ) : (
              <>Start Next Drill <ArrowRight className="ml-1 h-4 w-4" /></>
            )}
          </Button>
          {error &&
            (isApiKeyError(error) ? (
              <ApiKeyNotice code={error.code} message={error.message} />
            ) : (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error.message}</p>
            ))}
        </CardContent>
      </Card>
    );
  }

  // ---- Not enrolled ----
  return (
    <Card data-testid="experiment-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-blue-600" /> Find Your Reading Protocol
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Passage-first, question-first, or skim-then-verify? Run a real experiment
          on yourself: {DRILLS_PER_ARM} matched drills per protocol, and the data
          decides which one scores best for you.
        </p>
        <Button onClick={enroll} disabled={busy} variant="outline" className="w-full">
          {busy ? (
            <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Setting up...</>
          ) : (
            'Start the Experiment'
          )}
        </Button>
        {error &&
          (isApiKeyError(error) ? (
            <ApiKeyNotice code={error.code} message={error.message} />
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error.message}</p>
          ))}
      </CardContent>
    </Card>
  );
}
