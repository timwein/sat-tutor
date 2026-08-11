export const dynamic = 'force-dynamic';

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

  // Resolve evidence question ids referenced by the insight so cards can
  // show the actual questions behind each finding.
  let evidenceMap: Record<
    string,
    { question_id: string; question_text: string; sub_skill_id: string; section: string }
  > = {};
  if (latestInsight) {
    const insight = latestInsight as WrongAnswerInsight;
    const ids = new Set<string>();
    for (const item of insight.top_insights ?? []) {
      for (const id of item.evidence_question_ids ?? []) ids.add(id);
    }
    for (const detail of Object.values(insight.dimension_details ?? {})) {
      for (const id of detail.evidence_question_ids ?? []) ids.add(id);
    }
    if (ids.size > 0) {
      const { data: evidenceQuestions } = await supabase
        .from('questions')
        .select('question_id, question_text, sub_skill_id, section')
        .in('question_id', [...ids]);
      for (const q of evidenceQuestions ?? []) {
        evidenceMap[q.question_id] = q;
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Wrong Answer Intelligence</h1>
      <p className="text-gray-500 dark:text-gray-400">
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
          evidenceMap={evidenceMap}
        />
      ) : (
        <InsightsGeneratePrompt studentId={studentId} wrongAnswerCount={count} />
      )}
    </div>
  );
}
