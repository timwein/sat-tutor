export const dynamic = 'force-dynamic';

import { Shield } from 'lucide-react';
import { requireAdmin, isAdmin, hasApiKey } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { computeCurrentStreak, getWeeklyStats } from '@/lib/streak-calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/types';

interface AdminRow {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  hasKey: boolean;
  admin: boolean;
  currentStreak: number;
  questionsThisWeek: number;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLastSeen(value: string | null): string {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export default async function AdminPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data } = await supabase
    .from('students')
    .select('id, name, email, created_at, last_seen_at, is_admin, anthropic_key_ciphertext')
    .order('created_at', { ascending: true });

  const students = (data ?? []) as Pick<
    Student,
    'id' | 'name' | 'email' | 'created_at' | 'last_seen_at' | 'is_admin' | 'anthropic_key_ciphertext'
  >[];

  const rows: AdminRow[] = await Promise.all(
    students.map(async (s) => {
      const [streak, weekly] = await Promise.all([
        computeCurrentStreak(s.id),
        getWeeklyStats(s.id),
      ]);
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
        hasKey: hasApiKey(s),
        admin: isAdmin(s),
        currentStreak: streak.currentStreak,
        questionsThisWeek: weekly.questionsAnswered,
      };
    })
  );

  const withKey = rows.filter((r) => r.hasKey).length;

  return (
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <Shield className="h-7 w-7 text-blue-600" />
          Admin
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {rows.length} {rows.length === 1 ? 'student' : 'students'} · {withKey} with an API key
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Students</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto border-t dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr className="border-b dark:border-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2 whitespace-nowrap">Joined</th>
                  <th className="px-4 py-2 whitespace-nowrap">Last seen</th>
                  <th className="px-4 py-2 whitespace-nowrap">API key</th>
                  <th className="px-4 py-2 text-right">Streak</th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">This week</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No students yet.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center gap-2">
                        {row.name}
                        {row.admin && (
                          <Badge variant="outline" className="text-[10px] text-blue-700 dark:text-blue-300">
                            Admin
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {row.email ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-300">
                      {formatLastSeen(row.lastSeenAt)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {row.hasKey ? (
                        <span className="text-green-700 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {row.currentStreak}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {row.questionsThisWeek}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
