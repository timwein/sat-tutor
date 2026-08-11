import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  FULL_TEST_SEQUENCE,
  getModuleById,
  type FullTestStageResult,
} from '@/lib/practice-test-config';

/**
 * Advance a full practice test to its next stage. Persists stage progress in
 * session.metadata so a reload resumes exactly where the test left off.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, session_id, stage_result } = body as {
      student_id: string;
      session_id: string;
      stage_result?: FullTestStageResult;
    };

    if (!student_id || !session_id) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, session_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.student_id !== student_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const metadata = (session.metadata as Record<string, unknown>) ?? {};
    if (metadata.full_test !== true) {
      return NextResponse.json(
        { error: 'Not a full practice test session' },
        { status: 400 }
      );
    }

    const currentIndex = (metadata.stage_index as number) ?? 0;
    const nextIndex = currentIndex + 1;
    const stageResults = [
      ...((metadata.stage_results as FullTestStageResult[]) ?? []),
      ...(stage_result ? [stage_result] : []),
    ];

    if (nextIndex >= FULL_TEST_SEQUENCE.length) {
      // Final module already submitted with is_final: true - just record results
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ metadata: { ...metadata, stage_index: nextIndex, stage_results: stageResults } })
        .eq('id', session_id);
      if (updateError) {
        return NextResponse.json({ error: 'Failed to record results' }, { status: 500 });
      }
      return NextResponse.json({ done: true, stage_results: stageResults });
    }

    const nextStage = FULL_TEST_SEQUENCE[nextIndex];
    const now = new Date().toISOString();
    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      stage_index: nextIndex,
      stage_results: stageResults,
      stage_started_at: now,
    };

    if (nextStage.kind === 'break') {
      nextMetadata.break_until = new Date(Date.now() + nextStage.seconds * 1000).toISOString();
      delete nextMetadata.module_id;
    } else {
      const moduleDef = getModuleById(nextStage.moduleId);
      if (!moduleDef) {
        return NextResponse.json({ error: 'Unknown module in sequence' }, { status: 500 });
      }
      nextMetadata.module_id = moduleDef.id;
      nextMetadata.section = moduleDef.section;
      nextMetadata.time_limit_seconds = moduleDef.timeLimitSeconds;
      delete nextMetadata.break_until;
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ metadata: nextMetadata })
      .eq('id', session_id);

    if (updateError) {
      console.error('Failed to advance stage:', updateError);
      return NextResponse.json({ error: 'Failed to advance stage' }, { status: 500 });
    }

    return NextResponse.json({ done: false, metadata: nextMetadata });
  } catch (error) {
    console.error('Advance stage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
