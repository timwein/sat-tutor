import { NextRequest, NextResponse } from 'next/server';
import { classifyError } from '@/lib/claude';
import type { Question } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, student_answer, time_spent_seconds, confidence_level } = body;

    if (!question || !student_answer) {
      return NextResponse.json(
        { error: 'Missing required fields: question, student_answer' },
        { status: 400 }
      );
    }

    const typedQuestion = question as Question;

    const classification = await classifyError({
      question: typedQuestion,
      studentAnswer: student_answer,
      timeSpentSeconds: time_spent_seconds ?? null,
      confidenceLevel: confidence_level ?? null,
    });

    return NextResponse.json(classification);
  } catch (error) {
    console.error('Claude classify-error error:', error);
    return NextResponse.json(
      { error: 'Failed to classify error' },
      { status: 500 }
    );
  }
}
