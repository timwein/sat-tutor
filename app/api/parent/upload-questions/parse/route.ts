import { NextRequest, NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import {
  getAnthropicClient,
  anthropicErrorResponse,
  describeAnthropicError,
} from '@/lib/anthropic-client';
import { requireParentAccess } from '@/lib/parent-auth';
import { parseAnswersPdf, callClaudeStreaming } from '@/lib/pdf-question-parser';
import type { PdfType } from '@/lib/pdf-question-parser';
import { loadPrompt, interpolatePrompt } from '@/lib/prompt-utils';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const log = (msg: string) =>
    console.log(`[parse] +${((Date.now() - startTime) / 1000).toFixed(1)}s ${msg}`);

  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const parentDenied = await requireParentAccess(student.id);
    if (parentDenied) return parentDenied;

    const { type, text, moduleFilter } = (await request.json()) as {
      type: PdfType;
      text: string;
      moduleFilter?: string;
    };

    log(`type=${type} textLength=${text?.length ?? 0} moduleFilter=${moduleFilter ?? 'none'}`);

    if (!type || !text) {
      return NextResponse.json(
        { error: 'Missing type or text' },
        { status: 400 }
      );
    }

    // Built before any streaming starts so a missing key is a JSON 402, not
    // an error marker inside a text stream.
    const anthropic = getAnthropicClient(student);

    // Answers are small/fast — use simple JSON response
    if (type === 'answers') {
      log('calling parseAnswersPdf...');
      const data = await parseAnswersPdf(anthropic, text);
      log(`parseAnswersPdf returned ${data.length} answers`);
      return NextResponse.json({ type, data });
    }

    // Questions and explanations: stream Claude's raw text to client
    const promptTemplate = type === 'questions' ? 'pdf-parse-questions' : 'pdf-parse-explanations';
    const template = loadPrompt(promptTemplate);

    // Add module filter instruction if specified
    let extraInstruction = '';
    if (moduleFilter) {
      extraInstruction = `\n\nIMPORTANT: Extract ONLY the questions from "${moduleFilter}". Skip ALL questions from other modules. Output only the JSON array for this one module.`;
    }

    const systemPrompt = interpolatePrompt(template, { pdf_text: text }) + extraInstruction;

    log(`streaming Claude response for ${type} (${moduleFilter ?? 'all'})...`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendRaw = (rawText: string) => {
          try {
            controller.enqueue(encoder.encode(rawText));
          } catch {
            // controller closed
          }
        };

        try {
          await callClaudeStreaming(
            anthropic,
            `${type}${moduleFilter ? `-${moduleFilter}` : ''}`,
            systemPrompt,
            16000,
            (streamToken) => {
              sendRaw(streamToken);
            }
          );

          log(`Claude finished, total time ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          sendRaw('\n__DONE__');
          controller.close();
        } catch (error) {
          // Headers are already sent, so key problems are reported in-band as
          // a JSON { error, code } body after the error marker.
          const described = describeAnthropicError(error);
          const message = described
            ? described.message
            : error instanceof Error ? error.message : 'Internal server error';
          log(`ERROR: ${message}`);
          sendRaw(
            '\n__ERROR__:' +
              JSON.stringify({ error: message, code: described?.code })
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const keyResponse = anthropicErrorResponse(error);
    if (keyResponse) return keyResponse;

    console.error('Parse PDF error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
