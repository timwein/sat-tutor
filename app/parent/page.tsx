export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { requireStudent, isAdmin } from '@/lib/auth';
import { ParentDashboardShell } from '@/components/parent-dashboard-shell';

export default async function ParentPage() {
  const student = await requireStudent();
  const supabase = createServerClient();

  // Check if PIN is set up
  const { data: pinData } = await supabase
    .from('parent_access')
    .select('id')
    .eq('student_id', student.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Parent Dashboard</h1>
      <p className="text-gray-500 dark:text-gray-400">
        Monitor your student&apos;s progress and study habits.
      </p>
      <ParentDashboardShell
        studentId={student.id}
        hasPinSetup={!!pinData}
        isAdmin={isAdmin(student)}
      />
    </div>
  );
}
