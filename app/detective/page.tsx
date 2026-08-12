export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { DetectiveClient } from '@/components/detective-client';

export default async function DetectivePage() {
  const supabase = createServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  // How many WIC questions carry detective tags (drives the classifier hint)
  const { data: wic } = await supabase
    .from('questions')
    .select('question_id, tags')
    .eq('sub_skill_id', 'RW-05');
  const rows = (wic ?? []) as { question_id: string; tags: string[] | null }[];
  const taggedCount = rows.filter((q) =>
    (q.tags ?? []).some((t) => t.startsWith('clue:'))
  ).length;

  return (
    <DetectiveClient
      studentId={studentId}
      totalWicQuestions={rows.length}
      taggedWicQuestions={taggedCount}
    />
  );
}
