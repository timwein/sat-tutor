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
}: {
  sessionId: string;
  studentId: string;
  moduleId: string;
  section: 'math' | 'reading_writing';
  timeLimitSeconds: number;
  calculatorAllowed: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ModuleResult | null>(null);

  if (result) {
    return <ModuleReview result={result} studentId={studentId} onBack={() => router.push('/practice-test')} />;
  }

  return (
    <TimedSection
      sessionId={sessionId}
      studentId={studentId}
      moduleId={moduleId}
      section={section}
      timeLimitSeconds={timeLimitSeconds}
      calculatorAllowed={calculatorAllowed}
      onComplete={setResult}
    />
  );
}
