'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Calculator, ArrowRight } from 'lucide-react';
import type { Session } from '@/lib/types';

interface PracticeTestLauncherProps {
  studentId: string;
  recentSessions: Session[];
}

const SECTION_OPTIONS = [
  {
    moduleId: 'rw-module-1',
    label: 'Reading & Writing — Module 1',
    section: 'reading_writing' as const,
    questionCount: 27,
    timeLimitMinutes: 32,
    timeLimitSeconds: 32 * 60,
    icon: BookOpen,
    iconColor: 'text-blue-600',
    description: 'Passages, vocabulary, grammar, and rhetoric',
  },
  {
    moduleId: 'math-module-1',
    label: 'Math — Module 1',
    section: 'math' as const,
    questionCount: 22,
    timeLimitMinutes: 35,
    timeLimitSeconds: 35 * 60,
    icon: Calculator,
    iconColor: 'text-emerald-600',
    description: 'Algebra, advanced math, problem solving, and geometry',
  },
];

export function PracticeTestLauncher({ studentId, recentSessions }: PracticeTestLauncherProps) {
  const router = useRouter();
  const [startingModule, setStartingModule] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  async function startTimedSection(moduleId: string, section: 'math' | 'reading_writing', timeLimitSeconds: number) {
    setStartingModule(moduleId);
    setStartError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          session_type: 'timed_section',
          metadata: {
            module_id: moduleId,
            section,
            time_limit_seconds: timeLimitSeconds,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to create session');

      const { session } = await res.json();
      router.push(`/practice-test/${session.id}`);
    } catch (error) {
      console.error('Failed to start timed section:', error);
      setStartError("Couldn't start the section. Please try again.");
      setStartingModule(null);
    }
  }

  async function startFullTest() {
    setStartingModule('full-test');
    setStartError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          session_type: 'full_practice_test',
          metadata: {
            full_test: true,
            stage_index: 0,
            stage_results: [],
            stage_started_at: new Date().toISOString(),
            module_id: 'rw-module-1',
            section: 'reading_writing',
            time_limit_seconds: 32 * 60,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to create session');

      const { session } = await res.json();
      router.push(`/practice-test/${session.id}`);
    } catch (error) {
      console.error('Failed to start full practice test:', error);
      setStartError("Couldn't start the test. Please try again.");
      setStartingModule(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Practice Test</h1>
        <p className="mt-1 text-gray-500">
          Simulate real SAT conditions with timed sections. No hints available — just like test day.
        </p>
      </div>

      {/* Timed Section Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Timed Sections</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {SECTION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isStarting = startingModule === option.moduleId;

            return (
              <Card key={option.moduleId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${option.iconColor}`} />
                    {option.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-500">{option.description}</p>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-gray-400" />
                      <span>Up to {option.questionCount} questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{option.timeLimitMinutes} minutes</span>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() =>
                      startTimedSection(option.moduleId, option.section, option.timeLimitSeconds)
                    }
                    disabled={isStarting || startingModule !== null}
                  >
                    {isStarting ? 'Starting...' : 'Start'}
                    {!isStarting && <ArrowRight className="ml-1 h-4 w-4" />}
                  </Button>
                  {startError && startingModule === null && (
                    <p className="text-sm text-red-600" role="alert">
                      {startError}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Full Practice Test */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Full Practice Test</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Full-Length Practice Test
              <Badge variant="secondary" className="ml-2">All 4 modules</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-500">
              <p>
                The complete digital SAT experience: Reading &amp; Writing modules 1 and 2,
                a 10-minute break, then Math modules 1 and 2. Module 2 difficulty adapts
                to your module 1 performance, and you get an estimated score at the end.
              </p>
              <div className="flex justify-between">
                <span>Total questions</span>
                <span>Up to 98 questions</span>
              </div>
              <div className="flex justify-between">
                <span>Total time</span>
                <span>~2 hours 14 minutes</span>
              </div>
              <p className="text-xs text-gray-400">
                Set aside an uninterrupted block - the timer keeps running like on test day.
              </p>
            </div>
            <Button
              className="mt-4"
              onClick={startFullTest}
              disabled={startingModule !== null}
            >
              {startingModule === 'full-test' ? 'Starting...' : 'Start Full Practice Test'}
              {startingModule !== 'full-test' && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
            {startError && startingModule === null && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {startError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Practice Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Recent Practice Sessions</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {recentSessions.map((session) => {
                  const metadata = (session as Session & { metadata?: Record<string, unknown> }).metadata;
                  const sectionLabel =
                    metadata?.section === 'math'
                      ? 'Math'
                      : metadata?.section === 'reading_writing'
                        ? 'Reading & Writing'
                        : 'Timed Section';

                  return (
                    <button
                      key={session.id}
                      onClick={() => router.push(`/practice-test/${session.id}`)}
                      className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{sectionLabel}</Badge>
                        <span className="text-sm text-gray-600">
                          {new Date(session.started_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">
                          {session.questions_answered} questions
                        </span>
                        <span className="text-gray-500">
                          {session.accuracy != null
                            ? `${Math.round(session.accuracy * 100)}%`
                            : '--'}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
