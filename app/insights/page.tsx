import { createServerClient } from '@/lib/supabase';
import { PreThresholdCard } from '@/components/pre-threshold-card';
import { InsightsDashboard } from '@/components/insights-dashboard';
import { InsightsGeneratePrompt } from '@/components/insights-generate-prompt';
import type { WrongAnswerInsight } from '@/lib/types';

const INSIGHT_THRESHOLD = 10;

export default async function InsightsPage() {
  const supabase = createServerClient();

  // Load student
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  // Count wrong answers (excluding skips)
  const { count: wrongAnswerCount } = await supabase
    .from('question_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('is_correct', false)
    .neq('student_answer', 'SKIP');

  // Load latest insight
  const { data: latestInsight } = await supabase
    .from('wrong_answer_insights')
    .select('*')
    .eq('student_id', studentId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  const count = wrongAnswerCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Wrong Answer Intelligence</h1>
      <p className="text-gray-500">
        The AI analyzes your wrong answers across 8 dimensions to find hidden
        patterns.
      </p>

      {count < INSIGHT_THRESHOLD ? (
        <PreThresholdCard wrongAnswerCount={count} threshold={INSIGHT_THRESHOLD} />
      ) : latestInsight ? (
        <InsightsDashboard
          insight={latestInsight as WrongAnswerInsight}
          wrongAnswerCount={count}
          studentId={studentId}
        />
      ) : (
        <InsightsGeneratePrompt studentId={studentId} wrongAnswerCount={count} />
      )}
    </div>
  );
}
