import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireApiStudent } from '@/lib/auth';
import { getOptionalAnthropicClient, anthropicErrorResponse } from '@/lib/anthropic-client';
import { predictScore } from '@/lib/score-predictor';
import type { ScorePrediction } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await requireApiStudent(searchParams.get('student_id'));
    if (!auth.ok) return auth.response;
    const studentId = auth.student.id;

    const supabase = createServerClient();

    const { data } = await supabase
      .from('score_predictions')
      .select('*')
      .eq('student_id', studentId)
      .order('predicted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      prediction: (data as ScorePrediction | null) ?? null,
    });
  } catch (error) {
    console.error('Score prediction GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await requireApiStudent(body.student_id);
    if (!auth.ok) return auth.response;
    const { student } = auth;
    const studentId = student.id;

    // Students without an API key still get the Elo-based formula prediction
    const anthropic = getOptionalAnthropicClient(student);
    const result = await predictScore(anthropic, studentId);

    const supabase = createServerClient();

    const { data: saved, error: saveError } = await supabase
      .from('score_predictions')
      .insert({
        student_id: studentId,
        total_score_low: result.totalScoreLow,
        total_score_mid: result.totalScoreMid,
        total_score_high: result.totalScoreHigh,
        rw_score: result.rwScore,
        math_score: result.mathScore,
        confidence: result.confidence,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save score prediction:', saveError);
      return NextResponse.json(
        { error: 'Failed to save prediction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ prediction: saved as ScorePrediction });
  } catch (error) {
    const keyResponse = anthropicErrorResponse(error);
    if (keyResponse) return keyResponse;

    console.error('Score prediction POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
