'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, Pencil, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QuestionRow {
  question_id: string;
  correct_answer: string;
  tags: string[];
}

// Parse question_id like "cb_6_rw_m1_q1" into display parts
function parseQuestionId(qid: string): {
  testLabel: string;
  section: string;
  module: string;
  questionNum: number;
} | null {
  // Format: cb_{testLabel}_{section}_{module}_q{num}
  // section is "rw" or "math", module is "m1" or "m2"
  const match = qid.match(/^cb_(.+)_(rw|math)_(m[12])_q(\d+)$/);
  if (!match) return null;
  return {
    testLabel: match[1],
    section: match[2],
    module: match[3],
    questionNum: parseInt(match[4], 10),
  };
}

function formatTestLabel(raw: string): string {
  // Convert "6" → "Test 6", "practice_test_1" → "Practice Test 1"
  if (/^\d+$/.test(raw)) return `Test ${raw}`;
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatSection(section: string): string {
  return section === 'rw' ? 'RW' : 'Math';
}

function formatModule(module: string): string {
  return module === 'm1' ? 'Mod 1' : 'Mod 2';
}

export function QuestionBankOverview() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterTest, setFilterTest] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/parent/questions');
      if (!res.ok) throw new Error('Failed to fetch questions');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  function startEdit(qid: string, currentAnswer: string) {
    setEditingId(qid);
    setEditValue(currentAnswer);
  }

  async function saveEdit(qid: string) {
    const trimmed = editValue.trim().toUpperCase();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/parent/questions/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: qid, correctAnswer: trimmed }),
      });
      if (!res.ok) throw new Error('Failed to update');

      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === qid ? { ...q, correct_answer: trimmed } : q
        )
      );
      setEditingId(null);
    } catch {
      setError('Failed to save answer');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  // Get unique test labels for filter
  const testLabels = Array.from(
    new Set(
      questions
        .map((q) => parseQuestionId(q.question_id)?.testLabel)
        .filter(Boolean) as string[]
    )
  ).sort();

  // Filter and sort questions
  const filtered = questions.filter((q) => {
    const parsed = parseQuestionId(q.question_id);
    if (!parsed) return false;
    if (filterTest !== 'all' && parsed.testLabel !== filterTest) return false;
    if (filterSection !== 'all' && parsed.section !== filterSection) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return q.question_id.toLowerCase().includes(search) ||
        q.correct_answer.toLowerCase().includes(search);
    }
    return true;
  });

  // Sort: by test label, then section (rw first), then module, then question number
  const sorted = [...filtered].sort((a, b) => {
    const pa = parseQuestionId(a.question_id);
    const pb = parseQuestionId(b.question_id);
    if (!pa || !pb) return 0;
    if (pa.testLabel !== pb.testLabel) return pa.testLabel.localeCompare(pb.testLabel);
    if (pa.section !== pb.section) return pa.section === 'rw' ? -1 : 1;
    if (pa.module !== pb.module) return pa.module.localeCompare(pb.module);
    return pa.questionNum - pb.questionNum;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading questions...</span>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No questions in the bank yet. Upload a practice test to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Question Bank ({questions.length} questions)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterTest}
            onChange={(e) => setFilterTest(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-sm"
          >
            <option value="all">All Tests</option>
            {testLabels.map((t) => (
              <option key={t} value={t}>
                {formatTestLabel(t)}
              </option>
            ))}
          </select>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-sm"
          >
            <option value="all">All Sections</option>
            <option value="rw">Reading & Writing</option>
            <option value="math">Math</option>
          </select>
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 pl-7 pr-2 text-sm"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {sorted.length} shown
          </Badge>
        </div>

        {/* Table */}
        <div className="max-h-[500px] overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/60">
              <tr className="border-b text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2 w-24">Answer</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => {
                const parsed = parseQuestionId(q.question_id);
                if (!parsed) return null;
                const isEditing = editingId === q.question_id;

                return (
                  <tr
                    key={q.question_id}
                    className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {formatTestLabel(parsed.testLabel)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="text-gray-500 dark:text-gray-400">{formatSection(parsed.section)}</span>
                      {' '}
                      <span className="text-gray-400 dark:text-gray-500">{formatModule(parsed.module)}</span>
                      {' '}
                      <span className="font-medium">Q{parsed.questionNum}</span>
                    </td>
                    <td className="px-3 py-1.5 w-24">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(q.question_id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-12 rounded border border-blue-400 px-1.5 py-0.5 text-center text-sm font-medium uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            maxLength={10}
                          />
                          <button
                            onClick={() => saveEdit(q.question_id)}
                            disabled={saving}
                            className="rounded p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40"
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(q.question_id, q.correct_answer)}
                          className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        >
                          <span className="font-medium">{q.correct_answer}</span>
                          <Pencil className="h-3 w-3 text-gray-300 group-hover:text-blue-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
