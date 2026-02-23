import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { TestClient } from './test-client';

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
          <h1 className="text-2xl font-bold text-gray-800">Session Not Found</h1>
          <p className="mt-2 text-gray-500">
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
  } | null;

  if (!metadata) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Invalid Session</h1>
          <p className="mt-2 text-gray-500">
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

  return (
    <TestClient
      sessionId={session.id}
      studentId={session.student_id}
      moduleId={metadata.module_id}
      section={metadata.section}
      timeLimitSeconds={metadata.time_limit_seconds}
      calculatorAllowed={calculatorAllowed}
    />
  );
}
