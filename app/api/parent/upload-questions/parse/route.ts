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

    if (!type || !text) {
      return NextResponse.json(
        { error: 'Missing type or text' },
        { status: 400 }
      );
    }

    let data;
    if (type === 'questions') {
      data = await parseQuestionsPdf(text);
    } else if (type === 'answers') {
      data = await parseAnswersPdf(text);
    } else if (type === 'explanations') {
      data = await parseExplanationsPdf(text);
    } else {
      return NextResponse.json(
        { error: `Unknown PDF type: ${type}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ type, data });
  } catch (error) {
    console.error('Parse PDF error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
