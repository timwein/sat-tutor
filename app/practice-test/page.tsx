export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { PracticeTestLauncher } from '@/components/practice-test-launcher';
import type { Session } from '@/lib/types';

export default async function PracticeTestPage() {
  const supabase = createServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .limit(1)
    .single();

  const studentId = student?.id ?? '';

  const { data: sessions } = studentId
    ? await supabase
        .from('sessions')
        .select('*')
        .eq('student_id', studentId)
        .eq('session_type', 'timed_section')
        .order('started_at', { ascending: false })
        .limit(5)
    : { data: [] };

  return (
    <PracticeTestLauncher
      studentId={studentId}
      recentSessions={(sessions ?? []) as Session[]}
    />
  );
}
