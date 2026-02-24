import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import {
  parseQuestionsPdf,
  parseAnswersPdf,
  parseExplanationsPdf,
  callClaudeStreaming,
} from '@/lib/pdf-question-parser';
import type { PdfType, ParsedQuestion, ParsedAnswer, ParsedExplanation } from '@/lib/pdf-question-parser';
import { loadPrompt, interpolatePrompt } from '@/lib/prompt-utils';

export const maxDuration = 300;

/**
 * For questions and explanations, we stream Claude's tokens directly to the
 * client so the connection never goes idle (Vercel won't timeout a streaming
 * response as long as data flows every ~30s). For answers (small/fast), we
 * use the simpler non-streaming path.
 */
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

    // Answers are small/fast — use simple JSON response
    if (type === 'answers') {
      log('calling parseAnswersPdf...');
      const data = await parseAnswersPdf(text);
      log(`parseAnswersPdf returned ${data.length} answers`);
      return NextResponse.json({ type, data });
    }

    // Questions and explanations: stream Claude tokens to keep connection alive
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
            );
          } catch {
            // controller may be closed
          }
        };

        let tokenCount = 0;
        let lastProgressTime = Date.now();

        try {
          let promptTemplate: string;
          let maxTokens: number;

          if (type === 'questions') {
            promptTemplate = 'pdf-parse-questions';
            maxTokens = 32000;
          } else {
            promptTemplate = 'pdf-parse-explanations';
            maxTokens = 32000;
          }

          const template = loadPrompt(promptTemplate);
          const systemPrompt = interpolatePrompt(template, { pdf_text: text });

          log(`streaming Claude call for ${type}...`);

          const responseText = await callClaudeStreaming(
            type,
            systemPrompt,
            maxTokens,
            () => {
              tokenCount++;
              // Send progress every 2 seconds to keep connection alive
              const now = Date.now();
              if (now - lastProgressTime > 2000) {
                send({ progress: true, tokens: tokenCount });
                lastProgressTime = now;
              }
            }
          );

          log(`Claude finished — ${tokenCount} tokens, parsing JSON...`);

          // Extract and parse JSON from Claude's response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          const jsonStr = jsonMatch
            ? jsonMatch[0]
            : responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

          let data: ParsedQuestion[] | ParsedExplanation[];

          if (type === 'questions') {
            const parsed = JSON.parse(jsonStr) as ParsedQuestion[];
            data = parsed.map((q) => ({
              module: q.module,
              questionNumber: q.questionNumber,
              section: (q.module?.toLowerCase().includes('math') ? 'math' : 'reading_writing') as 'math' | 'reading_writing',
              questionText: q.questionText,
              passageText: q.passageText || null,
              answerChoices: q.answerChoices,
            }));
          } else {
            const parsed = JSON.parse(jsonStr) as ParsedExplanation[];
            data = parsed.map((e) => ({
              module: e.module,
              questionNumber: e.questionNumber,
              explanation: e.explanation,
              distractorAnalysis: e.distractorAnalysis || null,
            }));
          }

          log(`parsed ${data.length} items, total time ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          send({ type, data });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Internal server error';
          log(`ERROR: ${message}`);
          send({ error: message });
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
