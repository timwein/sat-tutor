'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { SessionTimer } from '@/components/session-timer';
import { QuestionCard } from '@/components/question-card';
import { AnswerChoices } from '@/components/answer-choices';
import { ConfidenceSelector } from '@/components/confidence-selector';
import { ExplanationPanel } from '@/components/explanation-panel';
import { SessionSummaryCard } from '@/components/session-summary-card';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type {
  SafeQuestion,
  AttemptResponse,
  SessionPhase,
  FrustrationState,
  EloUpdate,
  Session,
} from '@/lib/types';

type SessionState = 'loading' | 'answering' | 'submitting' | 'explaining' | 'ending' | 'ended';

interface ActiveSessionProps {
  sessionId: string;
  studentId: string;
  sessionType: string;
  startedAt: string;
  maxMinutes: number;
  maxQuestions: number;
}

// useIsMobile hook — defaults to false for SSR
function subscribeToMedia(cb: () => void) {
  const mql = window.matchMedia('(max-width: 767px)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function getIsMobileSnapshot() {
  return window.matchMedia('(max-width: 767px)').matches;
}
function getIsMobileServerSnapshot() {
  return false;
}
function useIsMobile() {
  return useSyncExternalStore(subscribeToMedia, getIsMobileSnapshot, getIsMobileServerSnapshot);
}

export function ActiveSession({
  sessionId,
  studentId,
  sessionType,
  startedAt,
  maxMinutes,
  maxQuestions,
}: ActiveSessionProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  // Core state machine
  const [state, setState] = useState<SessionState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<SafeQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<'guessing' | 'okay' | 'confident' | null>(null);
  const [crossedOut, setCrossedOut] = useState<Set<string>>(new Set());
  const questionStartTimeRef = useRef<number>(Date.now());
  const strengthBoostRef = useRef<number>(0);

  // Attempt result state
  const [attemptResult, setAttemptResult] = useState<AttemptResponse | null>(null);

  // Session tracking
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('warmup');
  const [frustrationState, setFrustrationState] = useState<FrustrationState | null>(null);
  const [eloChanges, setEloChanges] = useState<EloUpdate[]>([]);

  // End session state
  const [endedSession, setEndedSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState('');

  // Dialogs
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showFrustrationDialog, setShowFrustrationDialog] = useState(false);

  // Mobile sheet
  const [showExplanationSheet, setShowExplanationSheet] = useState(false);

  // End session
  const endSession = useCallback(async () => {
    setState('ending');
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to end session');
      }

      const session: Session & { insights_refresh_recommended?: boolean } =
        await res.json();
      setEndedSession(session);
      setSummary(session.summary || 'Great effort! Keep practicing to improve your skills.');
      setState('ended');

      // Enough new wrong answers accumulated - refresh the insight analysis
      // in the background so it's ready next time the Insights page opens.
      if (session.insights_refresh_recommended) {
        fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId }),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
      setState('answering');
    }
  }, [sessionId, studentId]);

  // Fetch next question
  const fetchNextQuestion = useCallback(async () => {
    setState('loading');
    setError(null);
    setShowExplanationSheet(false);

    // After choosing "switch to easier questions", the next few picks come
    // from the student's strongest skill to rebuild confidence.
    const preferStrength = strengthBoostRef.current > 0;
    if (preferStrength) strengthBoostRef.current -= 1;

    try {
      const res = await fetch('/api/questions/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          prefer_strength: preferStrength,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch question');
      }

      const data = await res.json();

      if (data.session_ended) {
        await endSession();
        return;
      }

      setCurrentQuestion(data.question);
      setQuestionNumber((prev) => prev + 1);
      setSelectedAnswer(null);
      setConfidence(null);
      setCrossedOut(new Set());
      setAttemptResult(null);
      questionStartTimeRef.current = Date.now();

      if (data.selection_metadata?.session_phase) {
        setSessionPhase(data.selection_metadata.session_phase);
      }
      if (data.selection_metadata?.frustration_state) {
        setFrustrationState(data.selection_metadata.frustration_state);
      }

      setState('answering');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setState('answering');
    }
  }, [sessionId, studentId, endSession]);

  // Submit answer
  async function submitAnswer() {
    if (!currentQuestion || !selectedAnswer) return;

    setState('submitting');
    setError(null);

    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          question_id: currentQuestion.question_id,
          student_answer: selectedAnswer,
          time_spent_seconds: timeSpent,
          confidence_level: confidence,
          skipped: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit answer');
      }

      const result: AttemptResponse = await res.json();
      setAttemptResult(result);
      setQuestionsAnswered(result.session_stats.questions_answered);
      setQuestionsCorrect(result.session_stats.questions_correct);
      setEloChanges((prev) => {
        const existing = prev.findIndex(
          (e) => e.sub_skill_id === result.elo_update.sub_skill_id
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result.elo_update;
          return updated;
        }
        return [...prev, result.elo_update];
      });
      setFrustrationState(result.frustration_state);

      if (result.frustration_state.recommendation === 'offer_choice') {
        setShowFrustrationDialog(true);
      }

      setState('explaining');

      // On mobile, show explanation in bottom sheet
      if (isMobile) {
        setShowExplanationSheet(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
      setState('answering');
    }
  }

  // Skip question
  async function skipQuestion() {
    if (!currentQuestion) return;

    setState('submitting');

    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          question_id: currentQuestion.question_id,
          student_answer: 'SKIP',
          time_spent_seconds: timeSpent,
          confidence_level: null,
          skipped: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to skip question');
      }

      const result: AttemptResponse = await res.json();
      setQuestionsAnswered(result.session_stats.questions_answered);
      setQuestionsCorrect(result.session_stats.questions_correct);

      await fetchNextQuestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip question');
      setState('answering');
    }
  }

  // Handle end session button
  function handleEndSession() {
    if (questionsAnswered === 0) {
      router.push('/study');
      return;
    }
    setShowEndConfirm(true);
  }

  // Fetch first question on mount
  useEffect(() => {
    fetchNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading state (initial)
  if (state === 'loading' && !currentQuestion) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-400">Loading your next question...</p>
        </div>
      </div>
    );
  }

  // Ending state
  if (state === 'ending') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-400">Generating your session summary...</p>
        </div>
      </div>
    );
  }

  // Session ended — show summary
  if (state === 'ended' && endedSession) {
    return (
      <div className="p-4 md:p-8">
        <SessionSummaryCard
          session={endedSession}
          summary={summary}
          eloChanges={eloChanges}
        />
      </div>
    );
  }

  // Explanation content (shared between inline and sheet)
  const explanationContent = state === 'explaining' && attemptResult && (
    <>
      <ExplanationPanel
        question={attemptResult.question}
        studentAnswer={selectedAnswer ?? ''}
        isCorrect={attemptResult.is_correct}
        studentId={studentId}
        frustrationLevel={
          frustrationState?.isFrustrated
            ? frustrationState.consecutiveWrong >= 5
              ? 'high'
              : 'medium'
            : 'none'
        }
      />
      <Button onClick={fetchNextQuestion} className="w-full">
        Next Question
      </Button>
    </>
  );

  // Active session (answering, submitting, explaining)
  return (
    <div className="flex h-full flex-col">
      <SessionTimer
        startedAt={startedAt}
        maxMinutes={maxMinutes}
        questionsAnswered={questionsAnswered}
        questionsCorrect={questionsCorrect}
        maxQuestions={maxQuestions}
        sessionPhase={sessionPhase}
        onEndSession={handleEndSession}
      />

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="mx-auto max-w-3xl space-y-4 md:space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {frustrationState?.recommendation === 'normalize' && state === 'answering' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Tricky questions! That&apos;s totally normal — these are meant to challenge you.
                The difficulty is adjusting to find your sweet spot.
              </span>
            </div>
          )}

          {currentQuestion && (
            <>
              <QuestionCard
                questionText={currentQuestion.question_text}
                passageText={currentQuestion.passage_text}
                subSkillId={currentQuestion.sub_skill_id}
                difficulty={currentQuestion.difficulty}
                questionNumber={questionNumber}
                totalQuestions={maxQuestions}
                isAiGenerated={currentQuestion.is_ai_generated}
              />

              <AnswerChoices
                choices={currentQuestion.answer_choices}
                selectedAnswer={selectedAnswer}
                onSelect={state === 'answering' ? setSelectedAnswer : () => {}}
                crossedOut={crossedOut}
                onToggleCrossOut={(letter) => {
                  if (state !== 'answering') return;
                  setCrossedOut((prev) => {
                    const next = new Set(prev);
                    if (next.has(letter)) next.delete(letter);
                    else next.add(letter);
                    return next;
                  });
                }}
                disabled={state !== 'answering'}
                correctAnswer={attemptResult?.correct_answer}
                showResult={state === 'explaining'}
              />

              {state === 'answering' && (
                <div className="space-y-4">
                  <ConfidenceSelector
                    selected={confidence}
                    onSelect={setConfidence}
                    disabled={false}
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={submitAnswer}
                      disabled={!selectedAnswer}
                      className="flex-1"
                    >
                      Submit Answer
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={skipQuestion}
                      className="text-gray-500 dark:text-gray-400"
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              )}

              {state === 'submitting' && (
                <div className="flex items-center justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Checking your answer...</span>
                </div>
              )}

              {/* Desktop: inline explanation */}
              {!isMobile && explanationContent}

              {/* Mobile: "Next Question" button when explanation sheet is showing */}
              {isMobile && state === 'explaining' && (
                <Button onClick={() => setShowExplanationSheet(true)} variant="outline" className="w-full">
                  View Explanation
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet for explanation */}
      {isMobile && (
        <Sheet open={showExplanationSheet} onOpenChange={setShowExplanationSheet}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Explanation</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              {explanationContent}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* End session confirmation dialog */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Session?</DialogTitle>
            <DialogDescription>
              You&apos;ve answered {questionsAnswered} of {maxQuestions} questions.
              Are you sure you want to end this session?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndConfirm(false)}>
              Keep Going
            </Button>
            <Button
              onClick={() => {
                setShowEndConfirm(false);
                endSession();
              }}
            >
              End Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Frustration intervention dialog */}
      <Dialog open={showFrustrationDialog} onOpenChange={setShowFrustrationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Let&apos;s Mix It Up</DialogTitle>
            <DialogDescription>
              These questions have been pretty challenging. Would you like to
              switch to some questions you&apos;re stronger at, or keep pushing through?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFrustrationDialog(false)}>
              Keep Going
            </Button>
            <Button
              onClick={() => {
                setShowFrustrationDialog(false);
                strengthBoostRef.current = 3;
                fetchNextQuestion();
              }}
            >
              Switch to Easier Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
