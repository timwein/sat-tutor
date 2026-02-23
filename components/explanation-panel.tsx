'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw, Send } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  Question,
  TutorMode,
  ExplanationStrategy,
  ExplainRequest,
} from '@/lib/types';

interface ExplanationPanelProps {
  question: Question;
  studentAnswer: string;
  isCorrect: boolean;
}

const MATH_STRATEGIES: ExplanationStrategy[] = [
  'algebraic_procedural',
  'visual_geometric',
  'plugin_backsolve',
  'real_world_analogy',
];

const RW_STRATEGIES: ExplanationStrategy[] = [
  'textual_evidence',
  'elimination_reasoning',
  'paraphrase_method',
  'pattern_recognition',
];

export function ExplanationPanel({
  question,
  studentAnswer,
  isCorrect,
}: ExplanationPanelProps) {
  const [explanation, setExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMode, setCurrentMode] = useState<TutorMode>('socratic');
  const [currentStrategy, setCurrentStrategy] = useState<ExplanationStrategy | undefined>(undefined);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [socraticInput, setSocraticInput] = useState('');
  const [exchangeCount, setExchangeCount] = useState(0);

  const strategies =
    question.section === 'math' ? MATH_STRATEGIES : RW_STRATEGIES;

  const fetchExplanation = useCallback(
    async (
      mode: TutorMode,
      strategy?: ExplanationStrategy,
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    ) => {
      setIsStreaming(true);
      setExplanation('');

      const body: ExplainRequest = {
        question,
        student_answer: studentAnswer,
        mode,
        strategy,
        conversation_history:
          mode === 'socratic' ? (history ?? conversationHistory) : undefined,
      };

      try {
        const response = await fetch('/api/claude/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-stream': 'true' },
          body: JSON.stringify(body),
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  accumulated += data.text;
                  setExplanation(accumulated);
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
          }
        }

        // Add the assistant response to conversation history for Socratic mode
        if (mode === 'socratic' && accumulated) {
          setConversationHistory((prev) => [
            ...prev,
            { role: 'assistant', content: accumulated },
          ]);
        }
      } catch {
        setExplanation('Failed to load explanation. Please try again.');
      }

      setIsStreaming(false);
    },
    [question, studentAnswer, conversationHistory]
  );

  // Auto-fetch explanation on mount
  useEffect(() => {
    fetchExplanation(currentMode, currentStrategy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeSwitch(mode: TutorMode) {
    if (mode === currentMode) return;
    setCurrentMode(mode);
    setConversationHistory([]);
    setExchangeCount(0);
    setSocraticInput('');
    fetchExplanation(mode, currentStrategy, []);
  }

  function handleSendSocratic() {
    if (!socraticInput.trim() || isStreaming) return;

    const userMessage = socraticInput.trim();
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage },
    ];
    setConversationHistory(updatedHistory);
    setSocraticInput('');
    setExchangeCount((prev) => prev + 1);
    fetchExplanation('socratic', currentStrategy, updatedHistory);
  }

  function handleCycleStrategy() {
    const currentIdx = currentStrategy
      ? strategies.indexOf(currentStrategy)
      : -1;
    const nextIdx = (currentIdx + 1) % strategies.length;
    const nextStrategy = strategies[nextIdx];
    setCurrentStrategy(nextStrategy);
    setConversationHistory([]);
    setExchangeCount(0);
    fetchExplanation(currentMode, nextStrategy, []);
  }

  return (
    <Card
      className={cn(
        'border-t-4',
        isCorrect ? 'border-t-green-500' : 'border-t-red-500'
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-700">Correct!</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-semibold text-red-700">
                Not quite right
              </span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={currentMode === 'socratic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeSwitch('socratic')}
            disabled={isStreaming}
            className="h-10 md:h-8"
          >
            Guide me
          </Button>
          <Button
            type="button"
            variant={currentMode === 'direct' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeSwitch('direct')}
            disabled={isStreaming}
            className="h-10 md:h-8"
          >
            Just tell me
          </Button>
        </div>

        {/* Explanation text area */}
        <div className="whitespace-pre-wrap text-gray-700">
          {explanation}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-gray-400" />
          )}
        </div>

        {/* Socratic mode: follow-up input */}
        {currentMode === 'socratic' && !isStreaming && explanation && (
          <div className="space-y-3">
            {exchangeCount >= 3 && (
              <p className="text-sm text-amber-600">
                Having trouble? Try{' '}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => handleModeSwitch('direct')}
                >
                  switching to direct mode
                </button>{' '}
                for a full explanation.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={socraticInput}
                onChange={(e) => setSocraticInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendSocratic();
                }}
                placeholder="Type your response..."
                className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:py-2 md:text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSendSocratic}
                disabled={!socraticInput.trim()}
                className="h-10 gap-1 md:h-8"
              >
                <Send className="h-4 w-4" />
                <span className="hidden md:inline">Send</span>
              </Button>
            </div>
          </div>
        )}

        {/* Strategy toggle */}
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCycleStrategy}
            disabled={isStreaming}
            className="text-gray-500"
          >
            <RefreshCw className="h-4 w-4" />
            Try a different explanation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
