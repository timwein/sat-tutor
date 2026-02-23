import { NextRequest, NextResponse } from 'next/server';
import { generateExplanation, streamExplanation } from '@/lib/claude';
import type { ExplainRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: ExplainRequest = await request.json();

    if (!body.question || !body.student_answer || !body.mode) {
      return NextResponse.json(
        { error: 'Missing required fields: question, student_answer, mode' },
        { status: 400 }
      );
    }

    const useStreaming = request.headers.get('x-stream') === 'true';

    if (useStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = streamExplanation({
              question: body.question,
              studentAnswer: body.student_answer,
              mode: body.mode,
              strategy: body.strategy,
              conversationHistory: body.conversation_history,
              studentProfile: body.student_profile,
            });

            for await (const chunk of generator) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('Stream error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
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

    const result = await generateExplanation({
      question: body.question,
      studentAnswer: body.student_answer,
      mode: body.mode,
      strategy: body.strategy,
      conversationHistory: body.conversation_history,
      studentProfile: body.student_profile,
    });

    return NextResponse.json({
      explanation: result.explanation,
      strategy_used: result.strategyUsed,
    });
  } catch (error) {
    console.error('Claude explain error:', error);
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    );
  }
}
