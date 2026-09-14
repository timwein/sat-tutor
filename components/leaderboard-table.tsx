import Link from 'next/link';
import { Flame, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LeaderboardRow } from '@/lib/leaderboard';

export function LeaderboardTable({
  rows,
  currentStudentId,
}: {
  rows: LeaderboardRow[];
  currentStudentId: string;
}) {
  const othersCount = rows.filter((r) => r.studentId !== currentStudentId).length;
  // getLeaderboard() only omits students who opted out, so the viewer being
  // absent from rows means they are hidden.
  const isHidden = !rows.some((r) => r.studentId === currentStudentId);

  const hiddenNotice = isHidden && (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      You are hidden from the leaderboard, so your row is not shown.{' '}
      <Link href="/settings" className="underline">
        Change this in Settings
      </Link>
      .
    </p>
  );

  if (othersCount === 0) {
    return (
      <>
        {hiddenNotice}
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nobody else is on the leaderboard yet. Invite a friend to start a friendly streak race.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {hiddenNotice}
      <Card>
        <CardContent className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr className="border-b dark:border-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2 w-12">#</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Streak</th>
                  <th className="px-4 py-2 text-right">Best</th>
                  <th className="px-4 py-2 text-right">Questions</th>
                  <th className="px-4 py-2 text-right">Accuracy</th>
                  <th className="px-4 py-2 text-right">Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rank = index + 1;
                  const isYou = row.studentId === currentStudentId;
                  return (
                    <tr
                      key={row.studentId}
                      className={cn(
                        'border-b last:border-0 dark:border-gray-800',
                        isYou
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-300">
                        {rank === 1 ? (
                          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                            <Trophy className="h-4 w-4" />
                            1
                          </span>
                        ) : (
                          rank
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2.5 whitespace-nowrap',
                          isYou
                            ? 'font-semibold text-blue-700 dark:text-blue-300'
                            : 'font-medium text-gray-900 dark:text-gray-100'
                        )}
                      >
                        {row.displayName}
                        {isYou && (
                          <span className="ml-1 text-xs font-normal text-blue-600 dark:text-blue-400">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 font-semibold',
                            row.currentStreak > 0
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-gray-400 dark:text-gray-500'
                          )}
                        >
                          <Flame className="h-4 w-4" />
                          {row.currentStreak}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {row.longestStreak}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {row.questionsThisWeek}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {row.accuracyThisWeek === null ? (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        ) : (
                          `${row.accuracyThisWeek}%`
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {row.daysActiveThisWeek}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
