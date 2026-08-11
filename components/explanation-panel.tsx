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
  /** Lets the tutor personalize explanations (loaded server-side) */
  studentId?: string;
  /** Current frustration level from the session's detector */
  frustrationLevel?: 'none' | 'medium' | 'high';
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

interface HelpButton {
  label: string;
  prompt: string;
  sections: Array<'math' | 'reading_writing'>;
}

const HELP_BUTTONS: HelpButton[] = [
  {
    label: 'Strategy for this question',
    prompt: "What's the best strategy for this type of question? Walk me through a step-by-step method.",
    sections: ['math', 'reading_writing'],
  },
  {
    label: 'Break down the passage',
    prompt: "Break down the passage for me. What are the key points, structure, and author's main argument?",
    sections: ['reading_writing'],
  },
  {
    label: 'Keywords to look for',
    prompt: "What key words or phrases in the question and answer choices should I focus on? What clues do they give?",
    sections: ['reading_writing'],
  },
  {
    label: "I'm stuck",
    prompt: "I'm completely stuck. Give me a strong hint without telling me the answer directly.",
    sections: ['math', 'reading_writing'],
  },
  {
    label: 'Help me eliminate wrong answers',
    prompt: "Help me eliminate wrong answers. Walk through each choice and explain why it's likely right or wrong.",
    sections: ['math', 'reading_writing'],
  },
];

export function ExplanationPanel({
  question,
  studentAnswer,
  isCorrect,
  studentId,
  frustrationLevel,
}: ExplanationPanelProps) {
  const [explanation, setExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMode, setCurrentMode] = useState<TutorMode>('socratic');
  const [currentStrategy, setCurrentStrategy] = useState<ExplanationStrategy | undefined>(undefined);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [userInput, setUserInput] = useState('');
  const [exchangeCount, setExchangeCount] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  const strategies =
    question.section === 'math' ? MATH_STRATEGIES : RW_STRATEGIES;

  const helpButtons = HELP_BUTTONS.filter((b) =>
    b.sections.includes(question.section)
  );

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
        conversation_history: history ?? conversationHistory,
        student_id: studentId,
        frustration_level: frustrationLevel,
      };

      try {
        const response = await fetch('/api/claude/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-stream': 'true' },
          body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) {
          setExplanation('');
          setStreamError('The tutor had trouble responding. Tap retry to try again.');
          setIsStreaming(false);
          return;
        }

        const reader = response.body.getReader();
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

        if (accumulated) {
          setConversationHistory((prev) => [
            ...prev,
            { role: 'assistant', content: accumulated },
          ]);
          setExplanation('');
          setStreamError(null);
        } else {
          setStreamError('The tutor had trouble responding. Tap retry to try again.');
        }
      } catch {
        setExplanation('');
        setStreamError('Connection problem while loading the explanation. Tap retry to try again.');
      }

      setIsStreaming(false);
    },
    [question, studentAnswer, conversationHistory, studentId, frustrationLevel]
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
    setUserInput('');
    fetchExplanation(mode, currentStrategy, []);
  }

  function handleSendMessage(message: string) {
    if (!message.trim() || isStreaming) return;

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: message.trim() },
    ];
    setConversationHistory(updatedHistory);
    setUserInput('');
    setExchangeCount((prev) => prev + 1);
    fetchExplanation(currentMode, currentStrategy, updatedHistory);
  }

  function handleHelpButton(prompt: string) {
    handleSendMessage(prompt);
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

        {/* Help buttons */}
        <div className="flex flex-wrap gap-2">
          {helpButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => handleHelpButton(btn.prompt)}
              disabled={isStreaming}
              className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Conversation transcript */}
        <div className="space-y-3">
          {conversationHistory.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3.5 py-2 text-sm text-white">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="whitespace-pre-wrap text-gray-700">
                {msg.content}
              </div>
            )
          )}
          {(isStreaming || explanation) && (
            <div className="whitespace-pre-wrap text-gray-700">
              {explanation}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-gray-400" />
              )}
            </div>
          )}
          {streamError && !isStreaming && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{streamError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchExplanation(currentMode, currentStrategy)}
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Always-visible free-text input */}
        {!isStreaming && (
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage(userInput);
              }}
              placeholder={exchangeCount > 0 ? "Enter your response..." : "Ask anything about this question..."}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:py-2 md:text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => handleSendMessage(userInput)}
              disabled={!userInput.trim()}
              className="h-10 gap-1 md:h-8"
            >
              <Send className="h-4 w-4" />
              <span className="hidden md:inline">Send</span>
            </Button>
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
