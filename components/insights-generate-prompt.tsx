'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface InsightsGeneratePromptProps {
  studentId: string;
  wrongAnswerCount: number;
}

export function InsightsGeneratePrompt({
  studentId,
  wrongAnswerCount,
}: InsightsGeneratePromptProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate insights');
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-blue-600" />
          <CardTitle>Ready for AI Analysis</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-700">
          You have{' '}
          <span className="font-semibold text-blue-600">
            {wrongAnswerCount}
          </span>{' '}
          wrong answers ready to analyze!
        </p>
        <p className="text-sm text-gray-500">
          The AI will examine your wrong answers across 8 dimensions to uncover
          hidden patterns and provide personalized recommendations.
        </p>

        {isLoading && (
          <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-sm text-blue-700">
              Analyzing your patterns... This may take 15-30 seconds
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-3">
        {error ? (
          <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
            Retry Analysis
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Insights'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
