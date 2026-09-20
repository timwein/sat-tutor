import type Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, interpolatePrompt } from './prompt-utils';
import { isStudentProduced, formatAcceptedAnswers } from './answer-format';
import type { TutorMode, ExplanationStrategy, Question, StudentProfile } from './types';

// There is no shared API key: every call takes the student's own client,
// built per request with getAnthropicClient() from lib/anthropic-client.ts.

export const MODELS = {
  SONNET: 'claude-sonnet-4-6',
  OPUS: 'claude-opus-5',
} as const;

// Opus 5 thinks by default and max_tokens caps thinking + visible text
// together, so explanation calls need more headroom than the old 1024.
const TUTOR_MAX_TOKENS = 4096;
const TUTOR_EFFORT = { effort: 'medium' as const };

export interface ExplainParams {
  question: Question;
  studentAnswer: string;
  mode: TutorMode;
  strategy?: ExplanationStrategy;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  studentProfile?: Partial<StudentProfile>;
}

interface TutorRequest {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  selectedStrategy: ExplanationStrategy;
}

/**
 * Appended to prompts for grid-in questions so the model never talks about
 * answer letters or distractors that do not exist.
 */
function studentProducedNote(correctAnswer: string): string {
  return (
    '\n\nANSWER FORMAT: This is a student-produced response question. There are no answer choices; ' +
    'the student typed their own numeric answer, shown above exactly as entered. Never refer to ' +
    'answer letters, "the choices" or distractors. Equivalent decimals and fractions are all ' +
    `correct (accepted: ${formatAcceptedAnswers(correctAnswer)}).`
  );
}

function buildTutorRequest(params: ExplainParams): TutorRequest {
  const { question, studentAnswer, mode, strategy, conversationHistory = [], studentProfile } = params;

  const promptTemplate = loadPrompt(mode === 'socratic' ? 'tutor-socratic' : 'tutor-direct');

  let systemPrompt = interpolatePrompt(promptTemplate, {
    student_profile: studentProfile ? JSON.stringify(studentProfile, null, 2) : 'No profile available yet.',
    question_context: JSON.stringify({
      question_id: question.question_id,
      section: question.section,
      sub_skill_id: question.sub_skill_id,
      difficulty: question.difficulty,
      question_text: question.question_text,
      passage_text: question.passage_text,
      answer_format: isStudentProduced(question) ? 'student_produced_response' : 'multiple_choice',
      answer_choices: question.answer_choices,
      correct_answer: question.correct_answer,
      tags: question.tags,
    }, null, 2),
    student_answer: studentAnswer,
    correct_answer: question.correct_answer,
  });

  if (isStudentProduced(question)) {
    systemPrompt += studentProducedNote(question.correct_answer);
  }

  // Words-in-Context: coach the decode method before revealing meanings.
  // The student is learning to solve these WITHOUT knowing the hard word.
  if (question.sub_skill_id === 'RW-05') {
    systemPrompt +=
      '\n\nVOCAB COACHING: This is a Words-in-Context question. Before explaining what any hard word means, walk the decode sequence the student is training: (1) the CHARGE the blank needs (positive/negative/neutral) and which words in the passage establish it, (2) the CONTEXT CLUE that signals it (restatement, contrast, cause-effect, example, or parallel structure - name the signal word), (3) only then connect the correct word to the decode, using roots or word-relatives when they help (e.g. credulous -> credible). If the student picked a wrong-charge word, point at the charge test first. Reinforce that unknown words should never be eliminated for being unknown.';
  }

  const selectedStrategy = strategy || getDefaultStrategy(question.section, mode);

  const initialUserMessage =
    mode === 'socratic'
      ? `I chose answer "${studentAnswer}" for this question. Can you help me understand why that might not be right?`
      : `I answered "${studentAnswer}" but the correct answer is "${question.correct_answer}". Please explain using the ${selectedStrategy.replace(/_/g, ' ')} approach.`;

  // The API requires the first message to be a user turn. The panel's history
  // starts with the tutor's auto-generated explanation, so prepend the implied
  // opening message when needed.
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (conversationHistory.length === 0) {
    messages.push({ role: 'user', content: initialUserMessage });
  } else {
    if (conversationHistory[0].role === 'assistant') {
      messages.push({ role: 'user', content: initialUserMessage });
    }
    messages.push(...conversationHistory);
    if (messages[messages.length - 1].role === 'assistant') {
      messages.push({ role: 'user', content: "I'm not sure, can you give me another hint?" });
    }
  }

  return { systemPrompt, messages, selectedStrategy };
}

/**
 * The system prompt (which embeds the question context) is identical across
 * every tutor call for the same question, so cache it - help-button and
 * follow-up calls then read the prefix at ~10% of input price.
 */
function cachedSystem(systemPrompt: string) {
  return [
    {
      type: 'text' as const,
      text: systemPrompt,
      cache_control: { type: 'ephemeral' as const },
    },
  ];
}

export async function generateExplanation(
  anthropic: Anthropic,
  params: ExplainParams
): Promise<{
  explanation: string;
  strategyUsed: ExplanationStrategy;
}> {
  const { systemPrompt, messages, selectedStrategy } = buildTutorRequest(params);

  const response = await anthropic.messages.create({
    model: MODELS.OPUS,
    max_tokens: TUTOR_MAX_TOKENS,
    output_config: TUTOR_EFFORT,
    system: cachedSystem(systemPrompt),
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return {
      explanation: "I couldn't generate an explanation for this question. Please try again or ask your tutor for help.",
      strategyUsed: selectedStrategy,
    };
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  const explanation = textBlock?.type === 'text' ? textBlock.text : '';

  return { explanation, strategyUsed: selectedStrategy };
}

export async function* streamExplanation(
  anthropic: Anthropic,
  params: ExplainParams
): AsyncGenerator<string> {
  const { systemPrompt, messages } = buildTutorRequest(params);

  const stream = anthropic.messages.stream({
    model: MODELS.OPUS,
    max_tokens: TUTOR_MAX_TOKENS,
    output_config: TUTOR_EFFORT,
    system: cachedSystem(systemPrompt),
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

export interface ClassifyErrorParams {
  question: Question;
  studentAnswer: string;
  timeSpentSeconds: number | null;
  confidenceLevel: string | null;
}

export interface ErrorClassification {
  error_type: string;
  explanation: string;
  distractor_type: string;
  what_student_likely_thought: string;
}

/**
 * Classify a wrong answer. Pass `null` for the client when the student has
 * no API key: the attempt is still recorded, just without a classification.
 * Returns `null` (never a placeholder) when there is no client or the model
 * output cannot be parsed, so callers leave the attempt unclassified rather
 * than persisting or displaying a fake classification.
 */
export async function classifyError(
  anthropic: Anthropic | null,
  params: ClassifyErrorParams
): Promise<ErrorClassification | null> {
  if (!anthropic) return null;
  const { question, studentAnswer, timeSpentSeconds, confidenceLevel } = params;

  const promptTemplate = loadPrompt('error-classifier');

  let systemPrompt = interpolatePrompt(promptTemplate, {
    question_text: question.question_text,
    correct_answer: question.correct_answer,
    student_answer: studentAnswer,
    time_seconds: String(timeSpentSeconds ?? 'unknown'),
    confidence_level: confidenceLevel ?? 'unknown',
  });
  if (isStudentProduced(question)) {
    systemPrompt += studentProducedNote(question.correct_answer);
  }

  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Classify this error. Return JSON only.' }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonString = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

function getDefaultStrategy(section: string, _mode: TutorMode): ExplanationStrategy {
  if (section === 'math') {
    return 'algebraic_procedural';
  }
  return 'elimination_reasoning';
}
