'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2, Target } from 'lucide-react';
import { GRAMMAR_RULES, type GrammarRule } from '@/lib/grammar-rules';

export interface RuleStats {
  attempted: number;
  correct: number;
  questionCount: number;
}

interface GrammarMapClientProps {
  studentId: string;
  statsByTag: Record<string, RuleStats>;
  untaggedCount: number;
}

const MIN_ATTEMPTS_FOR_SIGNAL = 3;

function cellTone(stats: RuleStats): string {
  if (stats.attempted < MIN_ATTEMPTS_FOR_SIGNAL) {
    return 'border-gray-200 dark:border-gray-700';
  }
  const acc = stats.correct / stats.attempted;
  if (acc >= 0.85) return 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30';
  if (acc >= 0.65) return 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30';
  return 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30';
}

export function GrammarMapClient({ studentId, statsByTag, untaggedCount }: GrammarMapClientProps) {
  const router = useRouter();
  const [openRule, setOpenRule] = useState<GrammarRule | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDrill(rule: GrammarRule) {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/grammar/drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, rule: rule.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start drill');
      router.push(`/study/${data.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start drill');
      setStarting(false);
    }
  }

  // ---- Lesson view ----
  if (openRule) {
    const stats = statsByTag[openRule.tag] ?? { attempted: 0, correct: 0, questionCount: 0 };
    return (
      <div className="space-y-4">
        <button
          onClick={() => setOpenRule(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" /> All rules
        </button>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {openRule.subSkillId === 'RW-10' ? 'Boundaries' : 'Form, Structure & Sense'} · 60-second lesson
              </p>
              <h2 className="mt-1 text-xl font-bold">{openRule.name}</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300">{openRule.rule}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
                <p className="text-xs font-semibold uppercase text-red-600 dark:text-red-400">Wrong</p>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{openRule.wrongExample}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/30">
                <p className="text-xs font-semibold uppercase text-green-600 dark:text-green-400">Fixed</p>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{openRule.fixedExample}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">The trap:</span>{' '}
                <span className="text-gray-600 dark:text-gray-300">{openRule.trap}</span></p>
              <p><span className="font-semibold">The tell:</span>{' '}
                <span className="text-gray-600 dark:text-gray-300">{openRule.tell}</span></p>
            </div>
            {stats.attempted >= MIN_ATTEMPTS_FOR_SIGNAL && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your record on this rule: {stats.correct}/{stats.attempted} correct
                ({Math.round((stats.correct / stats.attempted) * 100)}%)
              </p>
            )}
            <Button onClick={() => startDrill(openRule)} disabled={starting} className="w-full sm:w-auto">
              {starting ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Preparing drill...</>
              ) : (
                <><Target className="mr-1 h-4 w-4" /> Drill this rule</>
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Map view ----
  const groups: { label: string; subSkillId: 'RW-10' | 'RW-11' }[] = [
    { label: 'Boundaries (RW-10)', subSkillId: 'RW-10' },
    { label: 'Form, Structure & Sense (RW-11)', subSkillId: 'RW-11' },
  ];

  return (
    <div className="space-y-6">
      {untaggedCount > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {untaggedCount} conventions question{untaggedCount === 1 ? '' : 's'} not yet
          classified by rule - run the classifier from the Parent Dashboard to include them.
        </p>
      )}
      {groups.map((group) => (
        <div key={group.subSkillId}>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">{group.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GRAMMAR_RULES.filter((r) => r.subSkillId === group.subSkillId).map((rule) => {
              const stats = statsByTag[rule.tag] ?? { attempted: 0, correct: 0, questionCount: 0 };
              const hasSignal = stats.attempted >= MIN_ATTEMPTS_FOR_SIGNAL;
              return (
                <button
                  key={rule.id}
                  onClick={() => setOpenRule(rule)}
                  data-rule={rule.tag}
                  className={`rounded-lg border-2 p-4 text-left transition-shadow hover:shadow-md ${cellTone(stats)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{rule.name}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {hasSignal
                      ? `${Math.round((stats.correct / stats.attempted) * 100)}% · ${stats.attempted} attempts`
                      : stats.attempted > 0
                        ? `${stats.attempted} attempt${stats.attempted === 1 ? '' : 's'} - not enough data yet`
                        : 'Not attempted yet'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
