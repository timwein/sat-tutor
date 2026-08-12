'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Check, Loader2, SearchCheck, X } from 'lucide-react';
import { AnswerChoices } from '@/components/answer-choices';
import {
  CLUE_TYPES,
  getClueType,
  SAT_ROOTS,
  CHARGES,
  type Charge,
} from '@/lib/context-clues';
import type { SafeQuestion } from '@/lib/types';

const DRILL_SIZE = 8;

interface DetectiveClientProps {
  studentId: string;
  totalWicQuestions: number;
  taggedWicQuestions: number;
}

interface RoundRecord {
  questionId: string;
  pickedCharge: Charge | null;
  expectedCharge: string | null;
  chargeCorrect: boolean | null;
  pickedClue: string | null;
  expectedClue: string | null;
  clueCorrect: boolean | null;
  answerCorrect: boolean;
}

type Phase = 'primer' | 'loading' | 'decode' | 'answer' | 'feedback' | 'summary';

const CHARGE_STYLES: Record<Charge, string> = {
  positive: 'hover:border-green-500 hover:bg-green-50 dark:hover:border-green-500 dark:hover:bg-green-950/40',
  negative: 'hover:border-red-500 hover:bg-red-50 dark:hover:border-red-500 dark:hover:bg-red-950/40',
  neutral: 'hover:border-gray-500 hover:bg-gray-50 dark:hover:border-gray-400 dark:hover:bg-gray-800/60',
};

export function DetectiveClient({
  studentId,
  totalWicQuestions,
  taggedWicQuestions,
}: DetectiveClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('primer');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<SafeQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [pickedCharge, setPickedCharge] = useState<Charge | null>(null);
  const [pickedClue, setPickedClue] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [crossedOut, setCrossedOut] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    chargeCorrect: boolean | null;
    expectedCharge: string | null;
    clueCorrect: boolean | null;
    expectedClue: string | null;
    answerCorrect: boolean;
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
        setPickedCharge(null);
        setPickedClue(null);
        setSelectedAnswer(null);
        setCrossedOut(new Set());
        setFeedback(null);
        questionStartRef.current = Date.now();
        setPhase('decode');
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
          sub_skill_focus: 'RW-05',
          metadata: { mode: 'detective' },
        }),
      });
      if (!res.ok) throw new Error('Failed to start the detective drill');
      const { session } = await res.json();
      setSessionId(session.id);
      setRounds([]);
      await fetchNext(session.id, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
      setPhase('primer');
    }
  }

  async function submitAnswer() {
    if (!sessionId || !question || !selectedAnswer) return;
    const tags = question.tags ?? [];
    const expectedClue = tags.find((t) => t.startsWith('clue:'))?.slice('clue:'.length) ?? null;
    const expectedCharge = tags.find((t) => t.startsWith('charge:'))?.slice('charge:'.length) ?? null;
    const clueCorrect = expectedClue ? pickedClue === expectedClue : null;
    const chargeCorrect = expectedCharge ? pickedCharge === expectedCharge : null;

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
            detective: {
              picked_charge: pickedCharge,
              expected_charge: expectedCharge,
              charge_correct: chargeCorrect,
              picked_clue: pickedClue,
              expected_clue: expectedClue,
              clue_correct: clueCorrect,
            },
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to submit answer');
      const data = await res.json();
      setFeedback({
        chargeCorrect,
        expectedCharge,
        clueCorrect,
        expectedClue,
        answerCorrect: data.is_correct,
        correctAnswer: data.correct_answer,
        explanation: data.question?.explanation ?? null,
      });
      setRounds((prev) => [
        ...prev,
        {
          questionId: question.question_id,
          pickedCharge,
          expectedCharge,
          chargeCorrect,
          pickedClue,
          expectedClue,
          clueCorrect,
          answerCorrect: data.is_correct,
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
            <SearchCheck className="h-7 w-7 text-blue-600" /> Word Detective
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            The SAT writes vocab questions so you can solve them <em>without</em> knowing
            the hard word. The passage always leaves clues. This drill trains the decode:
            charge first, clue second, then the answer.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">The charge test</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Before anything else, decide from context: does the blank need a{' '}
              <span className="font-medium text-green-700 dark:text-green-400">positive</span>,{' '}
              <span className="font-medium text-red-700 dark:text-red-400">negative</span>, or{' '}
              <span className="font-medium">neutral</span> word? You usually know a
              word&apos;s vibe even when you can&apos;t define it - and wrong-charge choices
              are instant eliminations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">The five clue types (90-second read)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {CLUE_TYPES.map((clue) => (
                <div key={clue.id} className="rounded-lg border p-3 dark:border-gray-700">
                  <p className="text-sm font-semibold">{clue.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{clue.definition}</p>
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                    {clue.signalWords.slice(0, 4).map((w) => (
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
          <CardHeader>
            <CardTitle className="text-base">Roots crash course</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              A partial decode plus the charge test settles most unknown words.
              One golden rule: <strong>never eliminate a word just because you
              don&apos;t know it</strong> - when the familiar choices don&apos;t fit, the
              scary one is the answer.
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400">
                The 25 highest-yield roots &amp; prefixes
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-1 pr-3">Root</th>
                      <th className="py-1 pr-3">Means</th>
                      <th className="py-1">Examples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAT_ROOTS.map((r) => (
                      <tr key={r.root} className="border-t dark:border-gray-800">
                        <td className="py-1 pr-3 font-mono font-medium">{r.root}</td>
                        <td className="py-1 pr-3">{r.meaning}</td>
                        <td className="py-1 text-gray-500 dark:text-gray-400">{r.examples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Each question is two steps:</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                1. Decode the blank (charge + clue type, choices hidden). 2. Pick the word.
              </p>
            </div>
            <Button onClick={startDrill} size="lg" className="shrink-0">
              Start Detective Drill <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {taggedWicQuestions === 0 && totalWicQuestions > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            No vocab questions are clue-tagged yet, so the decode step won&apos;t be graded.
            Run the &quot;Context clues &amp; charge&quot; classifier from Parent Dashboard → Question Bank.
          </p>
        )}
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
    const chargeGraded = rounds.filter((r) => r.chargeCorrect !== null);
    const clueGraded = rounds.filter((r) => r.clueCorrect !== null);
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
    const chargeAcc = pct(chargeGraded.filter((r) => r.chargeCorrect).length, chargeGraded.length);
    const clueAcc = pct(clueGraded.filter((r) => r.clueCorrect).length, clueGraded.length);
    const answerAcc = pct(rounds.filter((r) => r.answerCorrect).length, rounds.length) ?? 0;

    const byClue = new Map<string, { total: number; correct: number }>();
    for (const r of clueGraded) {
      const key = r.expectedClue!;
      const entry = byClue.get(key) ?? { total: 0, correct: 0 };
      entry.total++;
      if (r.clueCorrect) entry.correct++;
      byClue.set(key, entry);
    }

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Detective Drill Complete</h1>
        <Card>
          <CardContent className="grid grid-cols-3 gap-4 pt-6 text-center">
            <div>
              <p className="text-3xl font-bold">{chargeAcc !== null ? `${chargeAcc}%` : '--'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Charge reads</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{clueAcc !== null ? `${clueAcc}%` : '--'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Clue spotting</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{answerAcc}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Answers</p>
            </div>
          </CardContent>
        </Card>
        {byClue.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clue spotting by type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...byClue.entries()].map(([tag, s]) => (
                <div key={tag} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm dark:border-gray-700">
                  <span className="font-medium">{getClueType(tag)?.name ?? tag}</span>
                  <span className={s.correct === s.total ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}>
                    {s.correct}/{s.total}
                  </span>
                </div>
              ))}
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

  // ---- Drill ----
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Word Detective · Question {questionNumber} of {DRILL_SIZE}
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

      {phase === 'decode' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decode the blank - choices stay hidden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">1. What charge does the blank need?</p>
              <div className="grid grid-cols-3 gap-2">
                {CHARGES.map((charge) => (
                  <button
                    key={charge}
                    onClick={() => setPickedCharge(charge)}
                    data-charge={charge}
                    className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium capitalize transition-colors dark:border-gray-700 ${CHARGE_STYLES[charge]} ${pickedCharge === charge ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40' : ''}`}
                  >
                    {charge}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">2. Which clue tells you?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CLUE_TYPES.map((clue) => (
                  <button
                    key={clue.id}
                    onClick={() => setPickedClue(clue.tag)}
                    data-clue={clue.tag}
                    className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-950/40 ${pickedClue === clue.tag ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40' : ''}`}
                  >
                    {clue.shortLabel}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => setPhase('answer')}
              disabled={!pickedCharge || !pickedClue}
              className="w-full"
            >
              Reveal Choices <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {(phase === 'answer' || phase === 'feedback') && (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your decode:{' '}
            <span className="font-medium capitalize text-gray-700 dark:text-gray-200">{pickedCharge}</span>
            {' · '}
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {getClueType(pickedClue ?? '')?.name ?? pickedClue}
            </span>
          </p>
          <AnswerChoices
            choices={question.answer_choices}
            selectedAnswer={selectedAnswer}
            onSelect={(a) => phase === 'answer' && setSelectedAnswer(a)}
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
          {phase === 'answer' && (
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
              {feedback.chargeCorrect === null ? (
                <Badge variant="outline">Charge ungraded</Badge>
              ) : feedback.chargeCorrect ? (
                <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
                  <Check className="h-3 w-3" /> Charge right
                </Badge>
              ) : (
                <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  <X className="h-3 w-3" /> Charge: {feedback.expectedCharge}
                </Badge>
              )}
              {feedback.clueCorrect === null ? (
                <Badge variant="outline">Clue ungraded</Badge>
              ) : feedback.clueCorrect ? (
                <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
                  <Check className="h-3 w-3" /> Clue right
                </Badge>
              ) : (
                <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  <X className="h-3 w-3" /> Clue: {getClueType(feedback.expectedClue ?? '')?.name ?? feedback.expectedClue}
                </Badge>
              )}
              {feedback.answerCorrect ? (
                <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
                  <Check className="h-3 w-3" /> Answer right
                </Badge>
              ) : (
                <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  <X className="h-3 w-3" /> Answer: {feedback.correctAnswer}
                </Badge>
              )}
            </div>
            {feedback.chargeCorrect && feedback.clueCorrect && !feedback.answerCorrect && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Your decode was right - the miss was in matching a word to it. Check
                whether a root or a near-synonym shade tripped you, and remember: an
                unfamiliar word that fits your decode beats a familiar one that doesn&apos;t.
              </p>
            )}
            {feedback.chargeCorrect === false && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                The charge was the miss - re-read the sentence around the blank and ask
                whether the passage is praising, criticizing, or just describing.
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
