'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CountdownTimer } from './countdown-timer';
import { QuestionNavigator } from './question-navigator';
import { AnswerChoices } from './answer-choices';
import { ConfidenceSelector } from './confidence-selector';
import { DesmosCalculator } from './desmos-calculator';
import { MathReferenceSheet } from './math-reference-sheet';
import type { SafeQuestion, ModuleResult, AnnotationMark } from '@/lib/types';

// ---------------------------------------------------------------------------
// Internal state type — mirrors PracticeQuestionState but uses string[] for
// crossedOut to avoid React state immutability issues with Set.
// ---------------------------------------------------------------------------
interface QuestionStateInternal {
  questionId: string;
  selectedAnswer: string | null;
  flagged: boolean;
  timeSpentMs: number;
  crossedOut: string[];
  confidenceLevel: 'guessing' | 'okay' | 'confident' | null;
  annotations: AnnotationMark[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TimedSectionProps {
  sessionId: string;
  studentId: string;
  moduleId: string;
  section: 'math' | 'reading_writing';
  timeLimitSeconds: number;
  calculatorAllowed: boolean;
  onComplete: (result: ModuleResult) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TimedSection({
  sessionId,
  studentId,
  moduleId,
  section,
  timeLimitSeconds,
  calculatorAllowed,
  onComplete,
}: TimedSectionProps) {
  // -----------------------------------------------------------------------
  // Phase state machine
  // -----------------------------------------------------------------------
  const [phase, setPhase] = useState<'loading' | 'testing' | 'submitting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Questions & per-question state
  // -----------------------------------------------------------------------
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [questionStates, setQuestionStates] = useState<QuestionStateInternal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // -----------------------------------------------------------------------
  // Per-question time tracking
  // -----------------------------------------------------------------------
  const lastNavTimestamp = useRef<number>(Date.now());

  // -----------------------------------------------------------------------
  // Tool toggles (math section)
  // -----------------------------------------------------------------------
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);

  // -----------------------------------------------------------------------
  // Derived Sets for QuestionNavigator
  // -----------------------------------------------------------------------
  const answeredSet = useMemo(() => {
    const set = new Set<number>();
    questionStates.forEach((qs, i) => {
      if (qs.selectedAnswer !== null) set.add(i);
    });
    return set;
  }, [questionStates]);

  const flaggedSet = useMemo(() => {
    const set = new Set<number>();
    questionStates.forEach((qs, i) => {
      if (qs.flagged) set.add(i);
    });
    return set;
  }, [questionStates]);

  // -----------------------------------------------------------------------
  // Current question convenience accessors
  // -----------------------------------------------------------------------
  const currentQuestion: SafeQuestion | undefined = questions[currentIndex];
  const currentState: QuestionStateInternal | undefined = questionStates[currentIndex];

  // -----------------------------------------------------------------------
  // Helper: flush elapsed time to current question state
  // -----------------------------------------------------------------------
  const flushTimeToCurrentQuestion = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastNavTimestamp.current;
    lastNavTimestamp.current = now;

    setQuestionStates((prev) => {
      const updated = [...prev];
      const idx = currentIndex;
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          timeSpentMs: updated[idx].timeSpentMs + elapsed,
        };
      }
      return updated;
    });
  }, [currentIndex]);

  // -----------------------------------------------------------------------
  // Load questions on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        const questionCount = section === 'math' ? 22 : 27;

        const res = await fetch('/api/practice-test/load-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: studentId,
            session_id: sessionId,
            section,
            question_count: questionCount,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load questions (${res.status})`);
        }

        const data = await res.json();
        const loadedQuestions: SafeQuestion[] = data.questions ?? data;

        if (cancelled) return;

        // Initialize per-question states
        const states: QuestionStateInternal[] = loadedQuestions.map((q) => ({
          questionId: q.question_id,
          selectedAnswer: null,
          flagged: false,
          timeSpentMs: 0,
          crossedOut: [],
          confidenceLevel: null,
          annotations: [],
        }));

        setQuestions(loadedQuestions);
        setQuestionStates(states);
        lastNavTimestamp.current = Date.now();
        setPhase('testing');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load questions');
        setPhase('error');
      }
    }

    loadQuestions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Navigation helpers
  // -----------------------------------------------------------------------
  function navigateTo(index: number) {
    if (index === currentIndex || index < 0 || index >= questions.length) return;
    flushTimeToCurrentQuestion();
    setCurrentIndex(index);
  }

  function goNext() {
    if (currentIndex < questions.length - 1) {
      navigateTo(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1);
    }
  }

  // -----------------------------------------------------------------------
  // Answer / confidence / flag / cross-out handlers
  // -----------------------------------------------------------------------
  function handleSelectAnswer(answer: string) {
    setQuestionStates((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        selectedAnswer: answer,
      };
      return updated;
    });
  }

  function handleConfidence(level: 'guessing' | 'okay' | 'confident') {
    setQuestionStates((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        confidenceLevel: level,
      };
      return updated;
    });
  }

  function toggleFlag() {
    setQuestionStates((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        flagged: !updated[currentIndex].flagged,
      };
      return updated;
    });
  }

  function handleToggleCrossOut(letter: string) {
    setQuestionStates((prev) => {
      const updated = [...prev];
      const current = updated[currentIndex];
      const crossed = current.crossedOut.includes(letter)
        ? current.crossedOut.filter((l) => l !== letter)
        : [...current.crossedOut, letter];
      updated[currentIndex] = {
        ...updated[currentIndex],
        crossedOut: crossed,
      };
      return updated;
    });
  }

  // -----------------------------------------------------------------------
  // Submit module
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    // Flush time for current question
    const now = Date.now();
    const elapsed = now - lastNavTimestamp.current;
    lastNavTimestamp.current = now;

    // Build finalized states with time flushed
    const finalStates = questionStates.map((qs, i) => ({
      ...qs,
      timeSpentMs: i === currentIndex ? qs.timeSpentMs + elapsed : qs.timeSpentMs,
    }));

    setPhase('submitting');

    try {
      const answers = finalStates.map((qs) => ({
        question_id: qs.questionId,
        student_answer: qs.selectedAnswer,
        time_spent_seconds: Math.round(qs.timeSpentMs / 1000),
        confidence_level: qs.confidenceLevel,
        flagged: qs.flagged,
        crossed_out: qs.crossedOut,
      }));

      const res = await fetch('/api/practice-test/submit-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          session_id: sessionId,
          module_id: moduleId,
          answers,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to submit module (${res.status})`);
      }

      const result: ModuleResult = await res.json();
      onComplete(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit module');
      setPhase('error');
    }
  }, [questionStates, currentIndex, studentId, sessionId, moduleId, onComplete]);

  const handleAutoSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  // -----------------------------------------------------------------------
  // Retry from error
  // -----------------------------------------------------------------------
  function handleRetry() {
    setErrorMessage(null);
    setPhase('testing');
  }

  // =========================================================================
  // RENDER — Loading Phase
  // =========================================================================
  if (phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading questions...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER — Error Phase
  // =========================================================================
  if (phase === 'error') {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <p className="text-center text-sm text-red-700">
              {errorMessage || 'An unexpected error occurred.'}
            </p>
            <Button onClick={handleRetry}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // RENDER — Submitting Phase
  // =========================================================================
  if (phase === 'submitting') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Submitting your answers...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER — Testing Phase
  // =========================================================================
  const hasPassage = Boolean(currentQuestion?.passage_text);

  return (
    <div className="flex h-full flex-col">
      {/* ================================================================= */}
      {/* Top Bar: Timer (left) + Navigator (right)                          */}
      {/* ================================================================= */}
      <div className="flex items-start justify-between border-b bg-white px-4 py-3">
        {/* Timer */}
        <CountdownTimer
          totalSeconds={timeLimitSeconds}
          onTimeUp={handleAutoSubmit}
          currentQuestion={currentIndex + 1}
          totalQuestions={questions.length}
        />

        {/* Navigator — collapsible on small screens */}
        <div className="max-w-[50%]">
          <QuestionNavigator
            totalQuestions={questions.length}
            currentIndex={currentIndex}
            onNavigate={navigateTo}
            answeredSet={answeredSet}
            flaggedSet={flaggedSet}
          />
        </div>
      </div>

      {/* ================================================================= */}
      {/* Main Content Area                                                  */}
      {/* ================================================================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* ----- Left column: Passage (only if present) ----- */}
        {hasPassage && (
          <div className="w-[40%] shrink-0 overflow-y-auto border-r p-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Passage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {currentQuestion!.passage_text}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ----- Right column: Question + Controls ----- */}
        <div
          className={`flex-1 overflow-y-auto p-6 ${hasPassage ? '' : 'mx-auto max-w-3xl'}`}
        >
          <div className="flex flex-col gap-6">
            {/* Question text */}
            {currentQuestion && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Question {currentIndex + 1}
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      of {questions.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium">{currentQuestion.question_text}</p>
                </CardContent>
              </Card>
            )}

            {/* Answer choices */}
            {currentQuestion && currentState && (
              <AnswerChoices
                choices={currentQuestion.answer_choices}
                selectedAnswer={currentState.selectedAnswer}
                onSelect={handleSelectAnswer}
                crossedOut={new Set(currentState.crossedOut)}
                onToggleCrossOut={handleToggleCrossOut}
                disabled={false}
                showResult={false}
              />
            )}

            {/* Confidence selector */}
            {currentState && (
              <ConfidenceSelector
                selected={currentState.confidenceLevel}
                onSelect={handleConfidence}
                disabled={false}
              />
            )}

            {/* Flag + Nav + Submit row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Flag toggle */}
              <Button
                variant="outline"
                onClick={toggleFlag}
                className={
                  currentState?.flagged
                    ? 'gap-2 border-orange-400 text-orange-600 hover:bg-orange-50'
                    : 'gap-2'
                }
              >
                {currentState?.flagged ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
                {currentState?.flagged ? 'Flagged' : 'Flag'}
              </Button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Prev */}
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>

              {/* Next */}
              <Button
                variant="outline"
                onClick={goNext}
                disabled={currentIndex === questions.length - 1}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Submit Module */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="gap-2">
                    <Send className="h-4 w-4" />
                    Submit Module
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit Module?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You have answered{' '}
                      <strong>{answeredSet.size}</strong> of{' '}
                      <strong>{questions.length}</strong> questions.
                      {answeredSet.size < questions.length && (
                        <>
                          {' '}
                          <span className="text-amber-600">
                            {questions.length - answeredSet.size} question
                            {questions.length - answeredSet.size !== 1 ? 's are' : ' is'}{' '}
                            unanswered.
                          </span>
                        </>
                      )}
                      {flaggedSet.size > 0 && (
                        <>
                          {' '}
                          You still have{' '}
                          <span className="text-orange-600">
                            {flaggedSet.size} flagged
                          </span>{' '}
                          question{flaggedSet.size !== 1 ? 's' : ''}.
                        </>
                      )}
                      <br />
                      <br />
                      Once submitted, you cannot go back. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Working</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>
                      Submit Module
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Math tools row */}
            {section === 'math' && (
              <div className="flex items-center gap-3">
                <MathReferenceSheet
                  isOpen={referenceOpen}
                  onToggle={() => setReferenceOpen((prev) => !prev)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Floating Desmos calculator (math section only)                     */}
      {/* ================================================================= */}
      {section === 'math' && calculatorAllowed && (
        <DesmosCalculator
          isOpen={calculatorOpen}
          onToggle={() => setCalculatorOpen((prev) => !prev)}
        />
      )}
    </div>
  );
}
