import { NextRequest, NextResponse } from 'next/server';
import { classifyError } from '@/lib/claude';
import { requireApiStudent } from '@/lib/auth';
import { getAnthropicClient, anthropicErrorResponse } from '@/lib/anthropic-client';
import type { Question } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, student_answer, time_spent_seconds, confidence_level } = body;

    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const { student } = auth;

    if (!question || !student_answer) {
      return NextResponse.json(
        { error: 'Missing required fields: question, student_answer' },
        { status: 400 }
      );
    }

    const typedQuestion = question as Question;

    // A direct classification request needs the student's own key; the
    // batched, optional path lives in the session-end and submit-module routes.
    const anthropic = getAnthropicClient(student);

    const classification = await classifyError(anthropic, {
      question: typedQuestion,
      studentAnswer: student_answer,
      timeSpentSeconds: time_spent_seconds ?? null,
      confidenceLevel: confidence_level ?? null,
    });

    if (!classification) {
      return NextResponse.json(
        { error: 'Could not classify this answer. Please try again.', code: 'anthropic_error' },
        { status: 502 }
      );
    }

    return NextResponse.json(classification);
  } catch (error) {
    console.error('Claude classify-error error:', error);
    const keyResponse = anthropicErrorResponse(error);
    if (keyResponse) return keyResponse;
    return NextResponse.json(
      { error: 'Failed to classify error' },
      { status: 500 }
    );
  }
}
