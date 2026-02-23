import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { analyzePatterns } from '@/lib/pattern-analyzer';
import type { WrongAnswerInsight } from '@/lib/types';

const INSIGHT_THRESHOLD = 10;

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

    // Count total wrong answers (excluding skips)
    const { count: wrongCount } = await supabase
      .from('question_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('is_correct', false)
      .neq('student_answer', 'SKIP');

    // Fetch latest insight
    const { data: latestInsight } = await supabase
      .from('wrong_answer_insights')
      .select('*')
      .eq('student_id', studentId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    const count = wrongCount ?? 0;
    const typedInsight = latestInsight as WrongAnswerInsight | null;

    // Determine if regeneration is needed
    const shouldRegenerate = typedInsight
      ? count > typedInsight.total_wrong_answers_analyzed
      : count >= INSIGHT_THRESHOLD;

    return NextResponse.json({
      wrong_answer_count: count,
      threshold: INSIGHT_THRESHOLD,
      has_insights: !!typedInsight,
      latest_insight: typedInsight,
      should_regenerate: shouldRegenerate,
    });
  } catch (error) {
    console.error('Insights GET error:', error);
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

    const supabase = createServerClient();

    // Check threshold
    const { count: wrongCount } = await supabase
      .from('question_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student_id)
      .eq('is_correct', false)
      .neq('student_answer', 'SKIP');

    if ((wrongCount ?? 0) < INSIGHT_THRESHOLD) {
      return NextResponse.json(
        {
          error: `Need at least ${INSIGHT_THRESHOLD} wrong answers for insights. Currently: ${wrongCount ?? 0}`,
        },
        { status: 400 }
      );
    }

    // Run pattern analysis (this calls Claude Opus)
    const result = await analyzePatterns(student_id);

    // Save to wrong_answer_insights table
    const { data: saved, error: saveError } = await supabase
      .from('wrong_answer_insights')
      .insert({
        student_id,
        total_wrong_answers_analyzed: result.totalWrongAnswersAnalyzed,
        top_insights: result.topInsights,
        dimension_details: result.dimensionDetails,
        raw_analysis: result.rawAnalysis,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save insight:', saveError);
      return NextResponse.json(
        { error: 'Failed to save insight' },
        { status: 500 }
      );
    }

    return NextResponse.json(saved as WrongAnswerInsight);
  } catch (error) {
    console.error('Insights POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
