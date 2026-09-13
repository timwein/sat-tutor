export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { requireStudent } from '@/lib/auth';
import { GymClient } from '@/components/gym-client';

export default async function GymPage() {
  const student = await requireStudent();
  const studentId = student.id;
  const supabase = createServerClient();

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
