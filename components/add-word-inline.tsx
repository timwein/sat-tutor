'use client';

import { useState } from 'react';
import { BookmarkPlus, Check, Loader2 } from 'lucide-react';

interface AddWordInlineProps {
  studentId: string;
  /** Prefill (e.g. the tested word of a Words-in-Context question) */
  suggestedWord?: string;
  contextSentence?: string;
  sourceQuestionId?: string;
  sourceLabel?: string;
}

/**
 * Compact add-a-word control for post-test review screens - the timed-test
 * path into the word bank, since lookups are disabled while the clock runs.
 */
export function AddWordInline({
  studentId,
  suggestedWord,
  contextSentence,
  sourceQuestionId,
  sourceLabel,
}: AddWordInlineProps) {
  const [word, setWord] = useState(suggestedWord ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'added' | 'already' | 'error'>('idle');

  async function add() {
    const cleaned = word.trim();
    if (!cleaned) return;
    setState('saving');
    try {
      const res = await fetch('/api/word-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          word: cleaned,
          context_sentence: contextSentence ?? null,
          source_question_id: sourceQuestionId ?? null,
          source_label: sourceLabel ?? 'From a practice test',
        }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setState(data.already_banked ? 'already' : 'added');
    } catch {
      setState('error');
    }
  }

  if (state === 'added' || state === 'already') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
        <Check className="h-3.5 w-3.5" />
        {state === 'added' ? `"${word.trim()}" added to Word Bank` : `"${word.trim()}" is already banked`}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={word}
        onChange={(e) => { setWord(e.target.value); if (state === 'error') setState('idle'); }}
        placeholder="Word to bank..."
        aria-label="Word to add to word bank"
        className="w-36 rounded-md border px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
      />
      <button
        onClick={add}
        disabled={state === 'saving' || !word.trim()}
        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
      >
        {state === 'saving' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <BookmarkPlus className="h-3 w-3" />
        )}
        Word Bank
      </button>
      {state === 'error' && (
        <span className="text-xs text-red-600 dark:text-red-400">Try again</span>
      )}
    </div>
  );
}
