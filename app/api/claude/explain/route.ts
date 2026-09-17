import { NextRequest, NextResponse } from 'next/server';
import { generateExplanation, streamExplanation } from '@/lib/claude';
import { createServerClient } from '@/lib/supabase';
import { requireApiStudent } from '@/lib/auth';
import {
  getAnthropicClient,
  anthropicErrorResponse,
  describeAnthropicError,
} from '@/lib/anthropic-client';
import { buildTutorProfile } from '@/lib/student-profile';
import type { ExplainRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: ExplainRequest = await request.json();

    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const { student } = auth;

    if (!body.question || !body.student_answer || !body.mode) {
      return NextResponse.json(
        { error: 'Missing required fields: question, student_answer, mode' },
        { status: 400 }
      );
    }

    // Build a personalized tutor profile server-side (skill levels, common
    // error patterns, current frustration) so explanations speak to the
    // student rather than to a generic 16-year-old.
    let studentProfile: Record<string, unknown> | undefined = body.student_profile as
      | Record<string, unknown>
      | undefined;
    try {
      const supabase = createServerClient();
      const serverProfile = await buildTutorProfile(
        supabase,
        student.id,
        body.question.sub_skill_id
      );
      studentProfile = { ...serverProfile, ...(studentProfile ?? {}) };
    } catch (profileErr) {
      console.error('Profile build failed (non-fatal):', profileErr);
    }
    if (body.frustration_level && body.frustration_level !== 'none') {
      studentProfile = {
        ...(studentProfile ?? {}),
        frustration_level: body.frustration_level,
        tutor_note:
          'The student is showing signs of frustration. Be extra encouraging, slow down, and celebrate any correct reasoning before addressing errors.',
      };
    }

    // Built before the stream so a missing or unreadable key is reported as
    // a JSON error rather than inside an SSE body.
    const anthropic = getAnthropicClient(student);

    const useStreaming = request.headers.get('x-stream') === 'true';

    if (useStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = streamExplanation(anthropic, {
              question: body.question,
              studentAnswer: body.student_answer,
              mode: body.mode,
              strategy: body.strategy,
              conversationHistory: body.conversation_history,
              studentProfile,
            });

            for await (const chunk of generator) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            const described = describeAnthropicError(error);
            const frame = described
              ? { error: described.message, code: described.code }
              : { error: 'Stream error' };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const result = await generateExplanation(anthropic, {
      question: body.question,
      studentAnswer: body.student_answer,
      mode: body.mode,
      strategy: body.strategy,
      conversationHistory: body.conversation_history,
      studentProfile,
    });

    return NextResponse.json({
      explanation: result.explanation,
      strategy_used: result.strategyUsed,
    });
  } catch (error) {
    console.error('Claude explain error:', error);
    const keyResponse = anthropicErrorResponse(error);
    if (keyResponse) return keyResponse;
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    );
  }
}
