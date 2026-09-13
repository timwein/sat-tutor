import { NextRequest, NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { getAnthropicClient, anthropicErrorResponse } from '@/lib/anthropic-client';
import { requireParentAccess } from '@/lib/parent-auth';
import { classifyBatch } from '@/lib/pdf-question-parser';
import type { MergedQuestion } from '@/lib/pdf-question-parser';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAdmin();
    if (!auth.ok) return auth.response;
    const { student } = auth;

    const parentDenied = await requireParentAccess(student.id);
    if (parentDenied) return parentDenied;

    const { batch } = (await request.json()) as {
      batch: MergedQuestion[];
    };

    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty batch' },
        { status: 400 }
      );
    }

    const anthropic = getAnthropicClient(student);
    const classifications = await classifyBatch(anthropic, batch);

    return NextResponse.json({ classifications });
  } catch (error) {
    const keyResponse = anthropicErrorResponse(error);
    if (keyResponse) return keyResponse;

    console.error('Classify batch error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
