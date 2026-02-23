import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { predictScore } from '@/lib/score-predictor';
import type { ScorePrediction } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: student_id' },
        { status: 400 }
      );
    }

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
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json(
        { error: 'Missing required field: student_id' },
        { status: 400 }
      );
    }

    const result = await predictScore(student_id);

    const supabase = createServerClient();

    const { data: saved, error: saveError } = await supabase
      .from('score_predictions')
      .insert({
        student_id,
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
    console.error('Score prediction POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
