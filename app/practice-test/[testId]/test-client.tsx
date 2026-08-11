'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TimedSection } from '@/components/timed-section';
import { ModuleReview } from '@/components/module-review';
import type { ModuleResult } from '@/lib/types';

export function TestClient({
  sessionId,
  studentId,
  moduleId,
  section,
  timeLimitSeconds,
  calculatorAllowed,
  protocolReminder,
}: {
  sessionId: string;
  studentId: string;
  moduleId: string;
  section: 'math' | 'reading_writing';
  timeLimitSeconds: number;
  calculatorAllowed: boolean;
  protocolReminder?: string | null;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ModuleResult | null>(null);

  if (result) {
    return <ModuleReview result={result} studentId={studentId} onBack={() => router.push('/practice-test')} />;
  }

  return (
    <>
      {protocolReminder && (
        <p className="border-b bg-blue-50 px-4 py-1.5 text-center text-xs font-medium text-blue-700 dark:border-gray-800 dark:bg-blue-950/40 dark:text-blue-300">
          {protocolReminder}
        </p>
      )}
      <TimedSection
        sessionId={sessionId}
        studentId={studentId}
        moduleId={moduleId}
        section={section}
        timeLimitSeconds={timeLimitSeconds}
        calculatorAllowed={calculatorAllowed}
        onComplete={setResult}
      />
    </>
  );
}
