'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Loader2, Plus, Sparkles } from 'lucide-react';

export interface WordBankWord {
  id: string;
  word: string;
  normalized_word: string;
  context_sentence: string | null;
  source_label: string | null;
  definition: string | null;
  connotation: 'positive' | 'negative' | 'neutral' | null;
  part_of_speech: string | null;
  usage_example: string | null;
  status: 'active' | 'mastered' | 'archived';
  from_miss: boolean;
  times_drilled: number;
  times_correct: number;
  drills_generated: boolean;
  added_at: string;
}

interface WordBankClientProps {
  studentId: string;
  initialWords: WordBankWord[];
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  mastered: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function WordBankClient({ studentId, initialWords }: WordBankClientProps) {
  const [words, setWords] = useState<WordBankWord[]>(initialWords);
  const [newWord, setNewWord] = useState('');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backfillStarted = useRef(false);

  const undrilled = words.filter(
    (w) => w.status === 'active' && !w.drills_generated
  ).length;

  // Lazily backfill definitions for auto-banked words (from misses)
  useEffect(() => {
    if (backfillStarted.current) return;
    const missing = words.filter((w) => !w.definition).slice(0, 5);
    if (missing.length === 0) return;
    backfillStarted.current = true;
    (async () => {
      for (const w of missing) {
        try {
          const res = await fetch('/api/word-bank/define', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word_id: w.id }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.definition) {
            setWords((prev) =>
              prev.map((p) => (p.id === w.id ? { ...p, ...data.definition } : p))
            );
          }
        } catch {
          // leave undefined; next visit retries
        }
      }
    })();
  }, [words]);

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    const word = newWord.trim();
    if (!word) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/word-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, word, source_label: 'Added manually' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add word');
      if (data.already_banked) {
        setMessage(`"${word}" is already in your bank.`);
      } else {
        setWords((prev) => [data.word, ...prev]);
        setMessage(null);
      }
      setNewWord('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add word');
    } finally {
      setAdding(false);
    }
  }

  async function generateDrills() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/word-bank/generate-drills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      if (data.generated > 0) {
        setMessage(
          `Generated ${data.generated} drill${data.generated === 1 ? '' : 's'} for ${data.words_drilled} word${data.words_drilled === 1 ? '' : 's'} - they're in your review queue for tomorrow.`
        );
        // Refresh drilled flags
        const listRes = await fetch(`/api/word-bank?student_id=${studentId}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          setWords(listData.words ?? []);
        }
      } else {
        setMessage(data.message ?? 'Nothing to generate right now.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={addWord} className="flex flex-1 gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Add a word from school reading..."
                aria-label="Add a word"
                className="w-full max-w-xs rounded-md border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              <Button type="submit" size="sm" disabled={adding || !newWord.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </form>
            <Button
              onClick={generateDrills}
              disabled={generating || undrilled === 0}
              size="sm"
              variant={undrilled > 0 ? 'default' : 'secondary'}
            >
              {generating ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Writing drills...</>
              ) : (
                <><Sparkles className="mr-1 h-4 w-4" /> Generate vocab drills{undrilled > 0 ? ` (${undrilled})` : ''}</>
              )}
            </Button>
          </div>
          {message && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400">{message}</p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
          )}
        </CardContent>
      </Card>

      {words.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <BookOpen className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No words yet. Tap any word in a study passage to look it up and bank it -
              or add one above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {words.map((w) => (
            <Card key={w.id}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold">{w.word}</span>
                    {w.part_of_speech && (
                      <span className="text-xs italic text-gray-400 dark:text-gray-500">
                        {w.part_of_speech}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[w.status]}`}>
                      {w.status}
                    </span>
                    {w.from_miss && (
                      <Badge variant="outline" className="text-xs">from a miss</Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {w.times_drilled > 0
                      ? `${w.times_correct}/${w.times_drilled} drills correct`
                      : w.drills_generated
                        ? 'drills in review queue'
                        : 'no drills yet'}
                  </span>
                </div>
                {w.definition ? (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{w.definition}</p>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Looking up definition...
                  </p>
                )}
                {(w.source_label || w.context_sentence) && (
                  <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                    {w.source_label}
                    {w.source_label && w.context_sentence ? ' · ' : ''}
                    {w.context_sentence ? `"${w.context_sentence.slice(0, 100)}${w.context_sentence.length > 100 ? '...' : ''}"` : ''}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
