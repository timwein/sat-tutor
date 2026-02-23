import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import { processUploadedPdfs } from '@/lib/pdf-question-parser';

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

    // Parse FormData
    const formData = await request.formData();
    const testLabel = formData.get('testLabel') as string;

    if (!testLabel || !testLabel.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: testLabel' },
        { status: 400 }
      );
    }

    // Extract PDF files
    const files: { name: string; buffer: Buffer }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        const arrayBuffer = await value.arrayBuffer();
        files.push({
          name: value.name,
          buffer: Buffer.from(arrayBuffer),
        });
      }
    }

    if (files.length < 2) {
      return NextResponse.json(
        { error: 'Please upload at least 2 PDF files (questions + answers)' },
        { status: 400 }
      );
    }

    // Validate file types
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only PDF files are accepted.` },
          { status: 400 }
        );
      }
    }

    // Process PDFs through the pipeline
    const result = await processUploadedPdfs(files, testLabel.trim());

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
