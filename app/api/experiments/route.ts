import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireApiStudent, forbiddenResponse } from '@/lib/auth';
import {
  EXPERIMENT_SKILL_POOL,
  emptyArms,
  nextArm,
  type ArmsState,
} from '@/lib/strategy-experiments';

/** Current experiment state for the signed-in student. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiStudent(request.nextUrl.searchParams.get('student_id'));
    if (!auth.ok) return auth.response;
    const studentId = auth.student.id;

    const supabase = createServerClient();
    const { data } = await supabase
      .from('strategy_experiments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ experiment: data ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Body: { action: 'enroll' } - start the experiment
 *       { action: 'start_drill' } - assign the next protocol
 *         and create its drill session
 * An optional experiment_id must belong to the signed-in student.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const studentId = auth.student.id;

    const { action } = body;
    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }
    const supabase = createServerClient();

    if (typeof body.experiment_id === 'string' && body.experiment_id.length > 0) {
      const { data: owned } = await supabase
        .from('strategy_experiments')
        .select('id, student_id')
        .eq('id', body.experiment_id)
        .maybeSingle();
      if (!owned) {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      if (owned.student_id !== studentId) {
        return forbiddenResponse();
      }
    }

    if (action === 'enroll') {
      const { data: existing } = await supabase
        .from('strategy_experiments')
        .select('id, status')
        .eq('student_id', studentId)
        .eq('status', 'running')
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ experiment_id: existing.id, already_running: true });
      }
      const { data: created, error } = await supabase
        .from('strategy_experiments')
        .insert({
          student_id: studentId,
          experiment_type: 'reading_protocol',
          status: 'running',
          arms: emptyArms(),
        })
        .select()
        .single();
      if (error || !created) {
        console.error('Failed to enroll experiment:', error);
        return NextResponse.json({ error: 'Failed to start experiment' }, { status: 500 });
      }
      return NextResponse.json({ experiment_id: created.id, already_running: false });
    }

    if (action === 'start_drill') {
      const { data: experiment } = await supabase
        .from('strategy_experiments')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'running')
        .maybeSingle();
      if (!experiment) {
        return NextResponse.json({ error: 'No running experiment' }, { status: 404 });
      }
      const arm = nextArm((experiment.arms as ArmsState) ?? emptyArms());

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          student_id: studentId,
          session_type: 'quick_drill',
          metadata: {
            experiment_id: experiment.id,
            experiment_arm: arm.tag,
            skill_pool: EXPERIMENT_SKILL_POOL,
          },
        })
        .select()
        .single();
      if (sessionError || !session) {
        console.error('Failed to create experiment drill:', sessionError);
        return NextResponse.json({ error: 'Failed to start drill' }, { status: 500 });
      }
      return NextResponse.json({ session_id: session.id, arm: arm.tag });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Experiment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
