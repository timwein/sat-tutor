import Anthropic from '@anthropic-ai/sdk';
import { loadPrompt, interpolatePrompt } from './prompt-utils';
import type { TutorMode, ExplanationStrategy, Question, StudentProfile } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const MODELS = {
  SONNET: 'claude-sonnet-4-5-20250514',
  OPUS: 'claude-opus-4-0-20250514',
} as const;

export interface ExplainParams {
  question: Question;
  studentAnswer: string;
  mode: TutorMode;
  strategy?: ExplanationStrategy;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  studentProfile?: Partial<StudentProfile>;
}

export async function generateExplanation(params: ExplainParams): Promise<{
  explanation: string;
  strategyUsed: ExplanationStrategy;
}> {
  const { question, studentAnswer, mode, strategy, conversationHistory = [], studentProfile } = params;

  const promptTemplate = loadPrompt(mode === 'socratic' ? 'tutor-socratic' : 'tutor-direct');

  const systemPrompt = interpolatePrompt(promptTemplate, {
    student_profile: studentProfile ? JSON.stringify(studentProfile, null, 2) : 'No profile available yet.',
    question_context: JSON.stringify({
      question_id: question.question_id,
      section: question.section,
      sub_skill_id: question.sub_skill_id,
      difficulty: question.difficulty,
      question_text: question.question_text,
      passage_text: question.passage_text,
      answer_choices: question.answer_choices,
      correct_answer: question.correct_answer,
      tags: question.tags,
    }, null, 2),
    student_answer: studentAnswer,
    correct_answer: question.correct_answer,
  });

  const selectedStrategy = strategy || getDefaultStrategy(question.section, mode);

  let userMessage: string;
  if (mode === 'socratic') {
    if (conversationHistory.length === 0) {
      userMessage = `I chose answer "${studentAnswer}" for this question. Can you help me understand why that might not be right?`;
    } else {
      userMessage = conversationHistory[conversationHistory.length - 1]?.content || "I'm not sure, can you give me another hint?";
    }
  } else {
    userMessage = `I answered "${studentAnswer}" but the correct answer is "${question.correct_answer}". Please explain using the ${selectedStrategy.replace(/_/g, ' ')} approach.`;
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (conversationHistory.length > 0 && mode === 'socratic') {
    for (const msg of conversationHistory.slice(0, -1)) {
      messages.push(msg);
    }
  }
  messages.push({ role: 'user', content: userMessage });

  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const explanation = response.content[0].type === 'text' ? response.content[0].text : '';

  return { explanation, strategyUsed: selectedStrategy };
}

export async function* streamExplanation(params: ExplainParams): AsyncGenerator<string> {
  const { question, studentAnswer, mode, strategy, conversationHistory = [], studentProfile } = params;

  const promptTemplate = loadPrompt(mode === 'socratic' ? 'tutor-socratic' : 'tutor-direct');

  const systemPrompt = interpolatePrompt(promptTemplate, {
    student_profile: studentProfile ? JSON.stringify(studentProfile, null, 2) : 'No profile available yet.',
    question_context: JSON.stringify({
      question_id: question.question_id,
      section: question.section,
      sub_skill_id: question.sub_skill_id,
      difficulty: question.difficulty,
      question_text: question.question_text,
      passage_text: question.passage_text,
      answer_choices: question.answer_choices,
      correct_answer: question.correct_answer,
      tags: question.tags,
    }, null, 2),
    student_answer: studentAnswer,
    correct_answer: question.correct_answer,
  });

  const selectedStrategy = strategy || getDefaultStrategy(question.section, mode);

  let userMessage: string;
  if (mode === 'socratic') {
    if (conversationHistory.length === 0) {
      userMessage = `I chose answer "${studentAnswer}" for this question. Can you help me understand why that might not be right?`;
    } else {
      userMessage = conversationHistory[conversationHistory.length - 1]?.content || "I'm not sure, can you give me another hint?";
    }
  } else {
    userMessage = `I answered "${studentAnswer}" but the correct answer is "${question.correct_answer}". Please explain using the ${selectedStrategy.replace(/_/g, ' ')} approach.`;
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (conversationHistory.length > 0 && mode === 'socratic') {
    for (const msg of conversationHistory.slice(0, -1)) {
      messages.push(msg);
    }
  }
  messages.push({ role: 'user', content: userMessage });

  const stream = anthropic.messages.stream({
    model: MODELS.SONNET,
    max_tokens: 1024,
    system: systemPrompt,
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

export async function classifyError(params: ClassifyErrorParams): Promise<ErrorClassification> {
  const { question, studentAnswer, timeSpentSeconds, confidenceLevel } = params;

  const promptTemplate = loadPrompt('error-classifier');

  const systemPrompt = interpolatePrompt(promptTemplate, {
    question_text: question.question_text,
    correct_answer: question.correct_answer,
    student_answer: studentAnswer,
    time_seconds: String(timeSpentSeconds ?? 'unknown'),
    confidence_level: confidenceLevel ?? 'unknown',
  });

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
    return {
      error_type: 'unknown',
      explanation: 'Could not classify this error automatically.',
      distractor_type: 'other',
      what_student_likely_thought: 'Unknown reasoning pattern.',
    };
  }
}

function getDefaultStrategy(section: string, _mode: TutorMode): ExplanationStrategy {
  if (section === 'math') {
    return 'algebraic_procedural';
  }
  return 'elimination_reasoning';
}
