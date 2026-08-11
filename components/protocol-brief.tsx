'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { getArm } from '@/lib/strategy-experiments';

interface ProtocolBriefProps {
  armTag: string;
  /** Rendered once the student starts the drill */
  children: React.ReactNode;
}

/**
 * Pre-drill instruction screen for strategy-experiment drills: names the
 * assigned protocol and how to execute it, then reveals the session.
 */
export function ProtocolBrief({ armTag, children }: ProtocolBriefProps) {
  const [started, setStarted] = useState(false);
  const arm = getArm(armTag);

  if (started || !arm) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
        <FlaskConical className="h-4 w-4" /> Reading Strategy Experiment
      </div>
      <Card>
        <CardHeader>
          <CardTitle>This drill&apos;s protocol: {arm.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-medium text-gray-800 dark:text-gray-200">{arm.instruction}</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
            {arm.how.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Stick to the protocol even if it feels slower - the experiment only
            works if each drill is a fair test. Your accuracy and pacing are
            compared across all three protocols once every arm has its drills.
          </p>
          <Button onClick={() => setStarted(true)} className="w-full" size="lg">
            Got it - start the drill <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
