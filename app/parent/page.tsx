export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { ParentDashboardShell } from '@/components/parent-dashboard-shell';

export default async function ParentPage() {
  const supabase = createServerClient();
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  // Check if PIN is set up
  const { data: pinData } = await supabase
    .from('parent_access')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Parent Dashboard</h1>
      <p className="text-gray-500">
        Monitor your student&apos;s progress and study habits.
      </p>
      <ParentDashboardShell
        studentId={studentId}
        hasPinSetup={!!pinData}
      />
    </div>
  );
}
