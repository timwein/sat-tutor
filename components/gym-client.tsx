'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Dumbbell, Loader2, X } from 'lucide-react';
import { AnswerChoices } from '@/components/answer-choices';
import { LOGIC_RELATIONSHIPS, getLogicRelationship } from '@/lib/logic-relationships';
import type { SafeQuestion } from '@/lib/types';

const DRILL_SIZE = 8;

interface GymClientProps {
  studentId: string;
  totalTransitionQuestions: number;
  taggedTransitionQuestions: number;
}

interface RoundRecord {
  questionId: string;
  pickedRelationship: string | null;
  expectedRelationship: string | null;
  step1Correct: boolean | null; // null = ungraded (question untagged)
  step2Correct: boolean;
}

type Phase = 'primer' | 'loading' | 'step1' | 'step2' | 'feedback' | 'summary';

export function GymClient({
  studentId,
  totalTransitionQuestions,
  taggedTransitionQuestions,
}: GymClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('primer');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<SafeQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [pickedRelationship, setPickedRelationship] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [crossedOut, setCrossedOut] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    step1Correct: boolean | null;
    expected: string | null;
    step2Correct: boolean;
    correctAnswer: string;
    explanation: string | null;
  } | null>(null);
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const questionStartRef = useRef<number>(0);
  const endingRef = useRef(false);

  const fetchNext = useCallback(
    async (sid: string, answeredSoFar: number) => {
      setPhase('loading');
      setError(null);
      try {
        const res = await fetch('/api/questions/next', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sid, student_id: studentId }),
        });
        if (!res.ok) throw new Error('Failed to load question');
        const data = await res.json();
        if (!data.question || answeredSoFar >= DRILL_SIZE) {
          setPhase('summary');
          return;
        }
        setQuestion(data.question);
        setQuestionNumber(answeredSoFar + 1);
        setPickedRelationship(null);
        setSelectedAnswer(null);
        setCrossedOut(new Set());
        setFeedback(null);
        questionStartRef.current = Date.now();
        setPhase('step1');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load question');
        setPhase('primer');
      }
    },
    [studentId]
  );

  async function startDrill() {
    setPhase('loading');
    setError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          session_type: 'quick_drill',
          sub_skill_focus: 'RW-09',
          metadata: { mode: 'gym' },
        }),
      });
      if (!res.ok) throw new Error('Failed to start the gym');
      const { session } = await res.json();
      setSessionId(session.id);
      setRounds([]);
      await fetchNext(session.id, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start the gym');
      setPhase('primer');
    }
  }

  function pickRelationship(tag: string) {
    setPickedRelationship(tag);
    setPhase('step2');
  }

  async function submitAnswer() {
    if (!sessionId || !question || !selectedAnswer) return;
    const expected =
      (question.tags ?? [])
        .find((t) => t.startsWith('logic:'))
        ?.slice('logic:'.length) ?? null;
    const step1Correct = expected ? pickedRelationship === expected : null;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          question_id: question.question_id,
          student_answer: selectedAnswer,
          time_spent_seconds: Math.round((Date.now() - questionStartRef.current) / 1000),
          metadata: {
            gym: {
              picked_relationship: pickedRelationship,
              expected_relationship: expected,
              step1_correct: step1Correct,
            },
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to submit answer');
      const data = await res.json();
      setFeedback({
        step1Correct,
        expected,
        step2Correct: data.is_correct,
        correctAnswer: data.correct_answer,
        explanation: data.question?.explanation ?? null,
      });
      setRounds((prev) => [
        ...prev,
        {
          questionId: question.question_id,
          pickedRelationship,
          expectedRelationship: expected,
          step1Correct,
          step2Correct: data.is_correct,
        },
      ]);
      setPhase('feedback');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    }
  }

  async function nextQuestion() {
    if (!sessionId) return;
    if (rounds.length >= DRILL_SIZE) {
      setPhase('summary');
      return;
    }
    await fetchNext(sessionId, rounds.length);
  }

  // End the session once the summary shows
  useEffect(() => {
    if (phase !== 'summary' || !sessionId || endingRef.current) return;
    endingRef.current = true;
    fetch(`/api/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    }).catch(() => {});
  }, [phase, sessionId, studentId]);

  // ---- Primer ----
  if (phase === 'primer') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Dumbbell className="h-7 w-7 text-blue-600" /> Transition Gym
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Transitions (RW-09) are the densest R/W points per practice hour. The
            trick: name the logic between the sentences <em>before</em> looking at
            the choices. This gym makes that a habit.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">The six relationships (90-second read)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {LOGIC_RELATIONSHIPS.map((rel) => (
                <div key={rel.id} className="rounded-lg border p-3 dark:border-gray-700">
                  <p className="text-sm font-semibold">{rel.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{rel.definition}</p>
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                    {rel.signalWords.slice(0, 4).map((w) => (
                      <span key={w} className="mr-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {w}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Each question is two steps:</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                1. Classify the relationship (choices hidden). 2. Pick the word.
                Feedback grades both.
              </p>
            </div>
            <Button onClick={startDrill} size="lg" className="shrink-0">
              Start Gym Drill <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {taggedTransitionQuestions === 0 && totalTransitionQuestions > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No transitions questions are relationship-tagged yet, so step 1 won&apos;t be
            graded. Run the classifier from the Parent Dashboard → Questions to enable it.
          </p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Also strong for verbal points: Rhetorical Synthesis.{' '}
          <button
            onClick={() => router.push('/study?focus=RW-08')}
            className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            Drill RW-08 →
          </button>
        </p>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        )}
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ---- Summary ----
  if (phase === 'summary') {
    const graded = rounds.filter((r) => r.step1Correct !== null);
    const step1Acc = graded.length
      ? Math.round((graded.filter((r) => r.step1Correct).length / graded.length) * 100)
      : null;
    const step2Acc = rounds.length
      ? Math.round((rounds.filter((r) => r.step2Correct).length / rounds.length) * 100)
      : 0;

    const byRelationship = new Map<string, { total: number; correct: number }>();
    for (const r of graded) {
      const key = r.expectedRelationship!;
      const entry = byRelationship.get(key) ?? { total: 0, correct: 0 };
      entry.total++;
      if (r.step1Correct) entry.correct++;
      byRelationship.set(key, entry);
    }

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Gym Drill Complete</h1>
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 text-center">
            <div>
              <p className="text-3xl font-bold">{step1Acc !== null ? `${step1Acc}%` : '--'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Relationship classification</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{step2Acc}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Answers correct</p>
            </div>
          </CardContent>
        </Card>
        {byRelationship.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classification by relationship</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...byRelationship.entries()].map(([tag, s]) => {
                const rel = getLogicRelationship(tag);
                return (
                  <div key={tag} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm dark:border-gray-700">
                    <span className="font-medium">{rel?.name ?? tag}</span>
                    <span className={s.correct === s.total ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}>
                      {s.correct}/{s.total}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
        <div className="flex gap-3">
          <Button onClick={startDrill} className="flex-1">Another Round</Button>
          <Button variant="outline" onClick={() => router.push('/')} className="flex-1">
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  // ---- Drill (step1 / step2 / feedback) ----
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Transition Gym · Question {questionNumber} of {DRILL_SIZE}
        </p>
        <Badge variant="secondary">{question.sub_skill_id}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          {question.passage_text && (
            <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {question.passage_text}
            </p>
          )}
          <p className="mt-3 text-base font-medium">{question.question_text}</p>
        </CardContent>
      </Card>

      {phase === 'step1' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Step 1 - What&apos;s the relationship across the blank?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LOGIC_RELATIONSHIPS.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => pickRelationship(rel.tag)}
                  data-relationship={rel.tag}
                  className="rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
                >
                  {rel.shortLabel}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Answer choices stay hidden until you commit to a relationship.
            </p>
          </CardContent>
        </Card>
      )}

      {(phase === 'step2' || phase === 'feedback') && (
        <>
          {pickedRelationship && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your read:{' '}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {getLogicRelationship(pickedRelationship)?.name ?? pickedRelationship}
              </span>
            </p>
          )}
          <AnswerChoices
            choices={question.answer_choices}
            selectedAnswer={selectedAnswer}
            onSelect={(a) => phase === 'step2' && setSelectedAnswer(a)}
            crossedOut={crossedOut}
            onToggleCrossOut={(a) =>
              setCrossedOut((prev) => {
                const next = new Set(prev);
                if (next.has(a)) next.delete(a);
                else next.add(a);
                return next;
              })
            }
            disabled={phase === 'feedback'}
            correctAnswer={feedback?.correctAnswer}
            showResult={phase === 'feedback'}
          />
          {phase === 'step2' && (
            <Button onClick={submitAnswer} disabled={!selectedAnswer} className="w-full">
              Submit
            </Button>
          )}
        </>
      )}

      {phase === 'feedback' && feedback && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {feedback.step1Correct === null ? (
                <Badge variant="outline">Relationship ungraded for this question</Badge>
              ) : feedback.step1Correct ? (
                <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
                  <Check className="h-3 w-3" /> Relationship right
                </Badge>
              ) : (
                <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  <X className="h-3 w-3" /> Relationship:{' '}
                  {getLogicRelationship(feedback.expected ?? '')?.name ?? feedback.expected}
                </Badge>
              )}
              {feedback.step2Correct ? (
                <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
                  <Check className="h-3 w-3" /> Answer right
                </Badge>
              ) : (
                <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  <X className="h-3 w-3" /> Answer: {feedback.correctAnswer}
                </Badge>
              )}
            </div>
            {feedback.step1Correct === false && feedback.step2Correct && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Right word, wrong logic - that&apos;s a lucky pick. Re-read the two
                sentences and find the {getLogicRelationship(feedback.expected ?? '')?.name.toLowerCase()} link.
              </p>
            )}
            {feedback.step1Correct === true && !feedback.step2Correct && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Right logic, wrong word - check the precise fit: some signal words
                can&apos;t open this kind of clause.
              </p>
            )}
            {feedback.explanation && (
              <p className="text-sm text-gray-600 dark:text-gray-300">{feedback.explanation}</p>
            )}
            <Button onClick={nextQuestion} className="w-full">
              {rounds.length >= DRILL_SIZE ? 'See Summary' : 'Next Question'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
}
