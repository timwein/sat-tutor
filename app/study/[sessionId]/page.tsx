import { createServerClient } from '@/lib/supabase';
import { SESSION_CONFIGS } from '@/lib/session-manager';
import { ActiveSession } from '@/components/active-session';
import type { Session } from '@/lib/types';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = createServerClient();

  const { data: sessionData, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !sessionData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Session not found</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            This session may have been deleted or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const session = sessionData as Session;
  const config = SESSION_CONFIGS[session.session_type] ?? SESSION_CONFIGS.study_session;

  return (
    <ActiveSession
      sessionId={sessionId}
      studentId={session.student_id}
      sessionType={session.session_type}
      startedAt={session.started_at}
      maxMinutes={config.durationMinutes}
      maxQuestions={config.maxQuestions}
    />
  );
}
