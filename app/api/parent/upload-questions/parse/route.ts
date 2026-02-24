import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import {
  parseQuestionsPdf,
  parseAnswersPdf,
  parseExplanationsPdf,
} from '@/lib/pdf-question-parser';
import type { PdfType } from '@/lib/pdf-question-parser';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const log = (msg: string) =>
    console.log(`[parse] +${((Date.now() - startTime) / 1000).toFixed(1)}s ${msg}`);

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;
    if (!token || !verifyAccessToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, text } = (await request.json()) as {
      type: PdfType;
      text: string;
    };

    log(`type=${type} textLength=${text?.length ?? 0}`);

    if (!type || !text) {
      return NextResponse.json(
        { error: 'Missing type or text' },
        { status: 400 }
      );
    }

    // Use SSE streaming with heartbeats to prevent gateway timeout
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send heartbeat every 10s to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ heartbeat: true })}\n\n`)
            );
            log('heartbeat sent');
          } catch {
            // controller may be closed
          }
        }, 10000);

        try {
          let data;
          if (type === 'questions') {
            log('calling parseQuestionsPdf...');
            data = await parseQuestionsPdf(text);
            log(`parseQuestionsPdf returned ${data.length} questions`);
          } else if (type === 'answers') {
            log('calling parseAnswersPdf...');
            data = await parseAnswersPdf(text);
            log(`parseAnswersPdf returned ${data.length} answers`);
          } else if (type === 'explanations') {
            log('calling parseExplanationsPdf...');
            data = await parseExplanationsPdf(text);
            log(`parseExplanationsPdf returned ${data.length} explanations`);
          } else {
            clearInterval(heartbeat);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: `Unknown PDF type: ${type}` })}\n\n`
              )
            );
            controller.close();
            return;
          }

          clearInterval(heartbeat);
          log(`sending result, total time ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          clearInterval(heartbeat);
          const message =
            error instanceof Error ? error.message : 'Internal server error';
          log(`ERROR: ${message}`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Parse PDF error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
