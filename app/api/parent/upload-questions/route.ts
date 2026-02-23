import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import { processExtractedTexts } from '@/lib/pdf-question-parser';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // Verify auth cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authResult = verifyAccessToken(token);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse JSON body (text already extracted client-side)
    const body = await request.json();
    const { testLabel, pdfTexts } = body as {
      testLabel: string;
      pdfTexts: { name: string; text: string }[];
    };

    if (!testLabel || !testLabel.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: testLabel' },
        { status: 400 }
      );
    }

    if (!pdfTexts || !Array.isArray(pdfTexts) || pdfTexts.length < 2) {
      return NextResponse.json(
        { error: 'Please upload at least 2 PDF files (questions + answers)' },
        { status: 400 }
      );
    }

    // Process extracted texts through the pipeline
    const result = await processExtractedTexts(pdfTexts, testLabel.trim());

    return NextResponse.json({
      questions: result.questions,
      summary: result.summary,
      testLabel: testLabel.trim(),
    });
  } catch (error) {
    console.error('Upload questions error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
