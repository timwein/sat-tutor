import { createServerClient } from '@/lib/supabase';
import { PracticeTestLauncher } from '@/components/practice-test-launcher';
import type { Session } from '@/lib/types';

export default async function PracticeTestPage() {
  const studentId = 'oren-student-001';
  const supabase = createServerClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_type', 'timed_section')
    .order('started_at', { ascending: false })
    .limit(5);

  return (
    <PracticeTestLauncher
      studentId={studentId}
      recentSessions={(sessions ?? []) as Session[]}
    />
  );
}
