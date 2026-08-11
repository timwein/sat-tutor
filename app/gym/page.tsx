export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { GymClient } from '@/components/gym-client';

export default async function GymPage() {
  const supabase = createServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  // How many transitions questions are relationship-tagged (drives a hint
  // to run the classifier if the gym would grade few step-1 answers)
  const { data: rw09 } = await supabase
    .from('questions')
    .select('question_id, tags')
    .eq('sub_skill_id', 'RW-09');
  const rows = (rw09 ?? []) as { question_id: string; tags: string[] | null }[];
  const taggedCount = rows.filter((q) =>
    (q.tags ?? []).some((t) => t.startsWith('logic:'))
  ).length;

  return (
    <GymClient
      studentId={studentId}
      totalTransitionQuestions={rows.length}
      taggedTransitionQuestions={taggedCount}
    />
  );
}
