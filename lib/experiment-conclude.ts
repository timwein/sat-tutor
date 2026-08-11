import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODELS } from '@/lib/claude';
import {
  emptyArms,
  isComplete,
  pickWinner,
  summarizeArms,
  getArm,
  type ArmsState,
} from '@/lib/strategy-experiments';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * Fold a finished drill session's attempts into its experiment arm, and
 * conclude the experiment once every arm has its full set of drills.
 * Called from the session end route; failures are non-fatal there.
 */
export async function tallyExperimentDrill(
  supabase: SupabaseClient,
  params: { experimentId: string; arm: string; sessionId: string }
): Promise<void> {
  const { experimentId, arm, sessionId } = params;

  const { data: experiment } = await supabase
    .from('strategy_experiments')
    .select('*')
    .eq('id', experimentId)
    .single();
  if (!experiment || experiment.status !== 'running') return;

  const { data: attempts } = await supabase
    .from('question_attempts')
    .select('is_correct, time_spent_seconds, student_answer')
    .eq('session_id', sessionId);
  const answered = (attempts ?? []).filter((a) => a.student_answer !== 'SKIP');
  if (answered.length === 0) return;

  const arms: ArmsState = { ...emptyArms(), ...(experiment.arms as ArmsState) };
  const tally = arms[arm] ?? { drills: 0, questions: 0, correct: 0, time_seconds: 0 };
  arms[arm] = {
    drills: tally.drills + 1,
    questions: tally.questions + answered.length,
    correct: tally.correct + answered.filter((a) => a.is_correct).length,
    time_seconds:
      tally.time_seconds +
      answered.reduce((s, a) => s + (a.time_spent_seconds ?? 0), 0),
  };

  const complete = isComplete(arms);
  let conclusion: Record<string, unknown> | null = null;

  if (complete) {
    const summaries = summarizeArms(arms);
    const winner = pickWinner(summaries);
    let verdictText: string | null = null;
    if (winner) {
      try {
        const response = await anthropic.messages.create({
          model: MODELS.SONNET,
          max_tokens: 400,
          system:
            'You summarize the result of a student\'s reading-strategy experiment in 2-3 plain sentences addressed to the student ("you"). State the winning protocol, the accuracy and pacing differences with real numbers, and note this is directional (small sample), not lab-grade. No markdown.',
          messages: [
            {
              role: 'user',
              content: JSON.stringify({
                winner: winner.tag,
                arms: summaries.map((s) => ({
                  protocol: s.name,
                  drills: s.drills,
                  questions: s.questions,
                  accuracy: s.accuracy !== null ? Math.round(s.accuracy * 100) : null,
                  seconds_per_question: s.median_seconds_per_question,
                })),
              }),
            },
          ],
        });
        const textBlock = response.content.find((b) => b.type === 'text');
        verdictText = textBlock?.type === 'text' ? textBlock.text.trim() : null;
      } catch {
        verdictText = null;
      }
      if (!verdictText) {
        const acc = winner.accuracy !== null ? Math.round(winner.accuracy * 100) : 0;
        verdictText = `${getArm(winner.tag)?.name ?? winner.tag} came out ahead: ${acc}% accuracy at ~${winner.median_seconds_per_question}s per question across ${winner.questions} questions. Directional result - keep using it and re-test before the real exam.`;
      }
      conclusion = {
        winner: winner.tag,
        winner_name: getArm(winner.tag)?.name ?? winner.tag,
        verdict: verdictText,
        arm_summaries: summaries,
      };
    }
  }

  await supabase
    .from('strategy_experiments')
    .update({
      arms,
      ...(complete && conclusion
        ? {
            status: 'concluded',
            conclusion,
            concluded_at: new Date().toISOString(),
          }
        : {}),
    })
    .eq('id', experimentId);
}
