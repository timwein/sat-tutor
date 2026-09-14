export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { requireStudent } from '@/lib/auth';
import { PracticeTestLauncher } from '@/components/practice-test-launcher';
import type { Session } from '@/lib/types';

export default async function PracticeTestPage() {
  const student = await requireStudent();
  const supabase = createServerClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', student.id)
    .eq('session_type', 'timed_section')
    .order('started_at', { ascending: false })
    .limit(5);

  return (
    <PracticeTestLauncher
      studentId={student.id}
      recentSessions={(sessions ?? []) as Session[]}
    />
  );
}
