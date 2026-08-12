'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Tags } from 'lucide-react';

type Kind = 'grammar' | 'logic' | 'detective';

interface KindState {
  preview: { total: number; already_tagged: number; to_classify: number } | null;
  running: boolean;
  result: string | null;
  error: string | null;
}

const KIND_LABELS: Record<Kind, { title: string; blurb: string }> = {
  grammar: {
    title: 'Grammar rules (RW-10 / RW-11)',
    blurb: 'Tags each conventions question with the named rule it tests, powering the Grammar Rule Map.',
  },
  logic: {
    title: 'Logic relationships (RW-09)',
    blurb: 'Tags each transitions question with its logic relationship, powering the Transition Gym.',
  },
  detective: {
    title: 'Context clues & charge (RW-05)',
    blurb: 'Tags each Words-in-Context question with its context-clue type and answer charge, powering the Word Detective.',
  },
};

export function ClassifyTagsCard() {
  const [state, setState] = useState<Record<Kind, KindState>>({
    grammar: { preview: null, running: false, result: null, error: null },
    logic: { preview: null, running: false, result: null, error: null },
    detective: { preview: null, running: false, result: null, error: null },
  });

  function update(kind: Kind, patch: Partial<KindState>) {
    setState((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }

  async function preview(kind: Kind) {
    update(kind, { running: true, error: null, result: null });
    try {
      const res = await fetch('/api/parent/classify-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Preview failed');
      update(kind, { preview: data, running: false });
    } catch (err) {
      update(kind, {
        running: false,
        error: err instanceof Error ? err.message : 'Preview failed',
      });
    }
  }

  async function run(kind: Kind) {
    update(kind, { running: true, error: null });
    try {
      const res = await fetch('/api/parent/classify-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Classification failed');
      update(kind, {
        running: false,
        preview: null,
        result: `Classified ${data.classified} question${data.classified === 1 ? '' : 's'}${data.skipped ? ` (${data.skipped} skipped - re-run to retry)` : ''}.`,
      });
    } catch (err) {
      update(kind, {
        running: false,
        error: err instanceof Error ? err.message : 'Classification failed',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4" /> Question Tag Classifier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          One-time setup (safe to re-run as the bank grows): classifies existing
          questions into the curated rule taxonomies. Preview shows counts before
          any model calls run.
        </p>
        {(Object.keys(KIND_LABELS) as Kind[]).map((kind) => {
          const s = state[kind];
          return (
            <div key={kind} className="rounded-lg border p-3 dark:border-gray-700">
              <p className="text-sm font-medium">{KIND_LABELS[kind].title}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {KIND_LABELS[kind].blurb}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {!s.preview ? (
                  <Button size="sm" variant="outline" onClick={() => preview(kind)} disabled={s.running}>
                    {s.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Preview'}
                  </Button>
                ) : (
                  <>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {s.preview.to_classify} to classify · {s.preview.already_tagged} already tagged
                    </span>
                    <Button
                      size="sm"
                      onClick={() => run(kind)}
                      disabled={s.running || s.preview.to_classify === 0}
                    >
                      {s.running ? (
                        <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Classifying...</>
                      ) : (
                        `Classify ${s.preview.to_classify}`
                      )}
                    </Button>
                  </>
                )}
              </div>
              {s.result && (
                <p className="mt-2 text-xs text-green-700 dark:text-green-400">{s.result}</p>
              )}
              {s.error && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{s.error}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
