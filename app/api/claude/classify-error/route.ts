import { NextRequest, NextResponse } from 'next/server';
import { classifyError } from '@/lib/claude';
import { requireApiStudent } from '@/lib/auth';
import { getOptionalAnthropicClient, anthropicErrorResponse } from '@/lib/anthropic-client';
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

    // Classification is optional enrichment: without a key it returns the
    // unclassified placeholder instead of failing.
    const anthropic = getOptionalAnthropicClient(student);

    const classification = await classifyError(anthropic, {
      question: typedQuestion,
      studentAnswer: student_answer,
      timeSpentSeconds: time_spent_seconds ?? null,
      confidenceLevel: confidence_level ?? null,
    });

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
