import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { TestClient } from './test-client';
import { FullTestClient } from '@/components/full-test-client';
import type { FullTestStageResult } from '@/lib/practice-test-config';

export default async function PracticeTestSessionPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const supabase = createServerClient();

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', testId)
    .single();

  if (error || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Session Not Found</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            This practice test session could not be found.
          </p>
          <a
            href="/practice-test"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to Practice Test
          </a>
        </div>
      </div>
    );
  }

  // If the session has ended, redirect back to the launcher
  if (session.ended_at) {
    redirect('/practice-test');
  }

  // Extract metadata for the timed section
  const metadata = session.metadata as {
    module_id: string;
    section: 'math' | 'reading_writing';
    time_limit_seconds: number;
    full_test?: boolean;
    stage_index?: number;
    stage_results?: FullTestStageResult[];
    stage_started_at?: string;
    break_until?: string | null;
  } | null;

  // Full practice test: the orchestrator drives module sequence + breaks.
  if (metadata?.full_test === true) {
    const stageStartedAt = metadata.stage_started_at ?? session.started_at;
    const stageElapsed = Math.floor(
      (Date.now() - new Date(stageStartedAt).getTime()) / 1000
    );
    const stageLimit = metadata.time_limit_seconds ?? 0;
    return (
      <FullTestClient
        sessionId={session.id}
        studentId={session.student_id}
        stageIndex={metadata.stage_index ?? 0}
        stageResults={metadata.stage_results ?? []}
        breakUntil={metadata.break_until ?? null}
        remainingSeconds={Math.max(0, stageLimit - stageElapsed)}
      />
    );
  }

  if (!metadata) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Invalid Session</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            This session is missing required configuration data.
          </p>
          <a
            href="/practice-test"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to Practice Test
          </a>
        </div>
      </div>
    );
  }

  const calculatorAllowed = metadata.section === 'math';

  // The clock runs from session start, so a page reload resumes with the
  // real remaining time instead of restarting the timer.
  const elapsedSeconds = Math.floor(
    (Date.now() - new Date(session.started_at).getTime()) / 1000
  );
  const remainingSeconds = Math.max(0, metadata.time_limit_seconds - elapsedSeconds);

  return (
    <TestClient
      sessionId={session.id}
      studentId={session.student_id}
      moduleId={metadata.module_id}
      section={metadata.section}
      timeLimitSeconds={remainingSeconds}
      calculatorAllowed={calculatorAllowed}
    />
  );
}
