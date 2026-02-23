import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/parent-auth';
import { classifyBatch } from '@/lib/pdf-question-parser';
import type { MergedQuestion } from '@/lib/pdf-question-parser';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;
    if (!token || !verifyAccessToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batch } = (await request.json()) as {
      batch: MergedQuestion[];
    };

    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty batch' },
        { status: 400 }
      );
    }

    const classifications = await classifyBatch(batch);

    return NextResponse.json({ classifications });
  } catch (error) {
    console.error('Classify batch error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
