export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { ExperimentPanel } from '@/components/experiment-panel';
import { EXPERIMENT_ARMS } from '@/lib/strategy-experiments';

export default async function StrategyPage() {
  const supabase = createServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  const { data: experimentRow } = await supabase
    .from('strategy_experiments')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Reading Strategy Lab</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          A real experiment on yourself: three reading protocols, matched drills,
          and the data decides which one scores best for you.
        </p>
      </div>

      <ExperimentPanel
        studentId={studentId}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        experiment={experimentRow as any}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {EXPERIMENT_ARMS.map((arm) => (
          <div key={arm.tag} className="rounded-lg border p-4 dark:border-gray-700">
            <p className="text-sm font-semibold">{arm.name}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{arm.instruction}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        How it works: each drill assigns one protocol, rotating so all three get
        equal, difficulty-matched practice. After 4 drills per protocol the lab
        declares a winner from accuracy and pacing, and its reminder appears
        before every Reading &amp; Writing timed section.
      </p>
    </div>
  );
}
