export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { getLeaderboard } from '@/lib/leaderboard';
import { LeaderboardTable } from '@/components/leaderboard-table';

export default async function LeaderboardPage() {
  const student = await requireStudent();
  const rows = await getLeaderboard();

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Leaderboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Streaks and this week&apos;s practice, ranked across everyone on SAT Tutor Pro.
        </p>
      </div>

      <LeaderboardTable rows={rows} currentStudentId={student.id} />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        A streak counts consecutive days with a qualifying study session. Weekly stats reset every
        Monday. Anyone can hide themselves from this page in{' '}
        <Link href="/settings" className="text-blue-600 hover:underline dark:text-blue-400">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
