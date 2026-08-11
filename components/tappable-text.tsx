'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Check, Loader2, X } from 'lucide-react';

interface TappableTextProps {
  text: string;
  studentId: string;
  sourceQuestionId?: string;
  sourceLabel?: string;
  className?: string;
}

interface WordDefinition {
  definition: string;
  connotation: 'positive' | 'negative' | 'neutral';
  part_of_speech: string;
  usage_example: string;
}

interface PopoverState {
  word: string;
  sentence: string;
  top: number;
  left: number;
}

const WORD_RE = /[A-Za-z][A-Za-z'-]{2,}/g;

/** The sentence containing the character offset, for in-context definitions. */
function sentenceAt(text: string, offset: number): string {
  let start = 0;
  for (let i = offset; i > 0; i--) {
    if ('.!?'.includes(text[i - 1])) { start = i; break; }
  }
  let end = text.length;
  for (let i = offset; i < text.length; i++) {
    if ('.!?'.includes(text[i])) { end = i + 1; break; }
  }
  return text.slice(start, end).trim();
}

const CONNOTATION_STYLES: Record<string, string> = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  negative: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

/**
 * Renders text with every word tappable: tapping opens a definition popover
 * with an Add-to-Word-Bank action. Study-mode only - timed sections never
 * render this component.
 */
export function TappableText({
  text,
  studentId,
  sourceQuestionId,
  sourceLabel,
  className,
}: TappableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [defError, setDefError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<'added' | 'already' | null>(null);

  const close = useCallback(() => {
    setPopover(null);
    setDefinition(null);
    setDefError(false);
    setSaving(false);
    setSaved(null);
  }, []);

  // Close when tapping outside
  useEffect(() => {
    if (!popover) return;
    function onDocDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) close();
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [popover, close]);

  async function openWord(word: string, sentence: string, spanEl: HTMLElement) {
    const container = containerRef.current;
    if (!container) return;
    const spanRect = spanEl.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    setPopover({
      word,
      sentence,
      top: spanRect.bottom - contRect.top + 6,
      left: Math.min(Math.max(spanRect.left - contRect.left, 0), Math.max(contRect.width - 288, 0)),
    });
    setDefinition(null);
    setDefError(false);
    setSaved(null);

    try {
      const res = await fetch('/api/word-bank/define', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, sentence }),
      });
      if (!res.ok) throw new Error('define failed');
      const data = await res.json();
      setDefinition(data);
    } catch {
      setDefError(true);
    }
  }

  async function addToBank() {
    if (!popover) return;
    setSaving(true);
    try {
      const res = await fetch('/api/word-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          word: popover.word,
          context_sentence: popover.sentence,
          source_question_id: sourceQuestionId ?? null,
          source_label: sourceLabel ?? null,
          ...(definition ?? {}),
        }),
      });
      if (!res.ok) throw new Error('add failed');
      const data = await res.json();
      setSaved(data.already_banked ? 'already' : 'added');
    } catch {
      setSaved(null);
      setDefError(true);
    } finally {
      setSaving(false);
    }
  }

  function handleWordClick(e: React.MouseEvent<HTMLSpanElement>, word: string, offset: number) {
    // A drag-selection also ends in a click; only treat collapsed selections as taps
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    e.stopPropagation();
    openWord(word, sentenceAt(text, offset), e.currentTarget);
  }

  // Tokenize once per render: alternating plain segments and tappable words
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of text.matchAll(WORD_RE)) {
    const idx = match.index ?? 0;
    if (idx > cursor) nodes.push(<span key={key++}>{text.slice(cursor, idx)}</span>);
    const word = match[0];
    nodes.push(
      <span
        key={key++}
        role="button"
        tabIndex={-1}
        data-word={word}
        onClick={(e) => handleWordClick(e, word, idx)}
        className="cursor-pointer rounded-sm decoration-dotted underline-offset-2 hover:bg-blue-50 hover:underline dark:hover:bg-blue-950/40"
      >
        {word}
      </span>
    );
    cursor = idx + word.length;
  }
  if (cursor < text.length) nodes.push(<span key={key++}>{text.slice(cursor)}</span>);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {nodes}
      {popover && (
        <div
          data-testid="word-popover"
          className="absolute z-30 w-72 rounded-lg border bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
          style={{ top: popover.top, left: popover.left }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold">{popover.word}</span>
            <button
              onClick={close}
              aria-label="Close definition"
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {!definition && !defError && (
            <p className="mt-2 flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking it up...
            </p>
          )}
          {defError && (
            <p className="mt-2 text-red-600 dark:text-red-400">
              Couldn&apos;t load that - tap the word again.
            </p>
          )}
          {definition && (
            <div className="mt-2 space-y-2">
              <p className="text-gray-700 dark:text-gray-300">{definition.definition}</p>
              <div className="flex items-center gap-2 text-xs">
                {definition.part_of_speech && (
                  <span className="italic text-gray-500 dark:text-gray-400">
                    {definition.part_of_speech}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${CONNOTATION_STYLES[definition.connotation] ?? CONNOTATION_STYLES.neutral}`}
                >
                  {definition.connotation}
                </span>
              </div>
              {definition.usage_example && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  &ldquo;{definition.usage_example}&rdquo;
                </p>
              )}
              <button
                onClick={addToBank}
                disabled={saving || saved !== null}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-70"
              >
                {saved === 'added' ? (
                  <><Check className="h-3.5 w-3.5" /> Added to Word Bank</>
                ) : saved === 'already' ? (
                  <><Check className="h-3.5 w-3.5" /> Already in your bank</>
                ) : saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding...</>
                ) : (
                  <><BookmarkPlus className="h-3.5 w-3.5" /> Add to Word Bank</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
