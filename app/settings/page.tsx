export const dynamic = 'force-dynamic';

import { requireStudent } from '@/lib/auth';
import { SettingsForm } from '@/components/settings-form';
import { ApiKeyCard } from '@/components/api-key-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default async function SettingsPage() {
  const student = await requireStudent();

  const settings = (student.settings as Record<string, unknown> | null) ?? {};

  return (
    <div className="mx-auto max-w-2xl space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Settings</h1>
      <p className="text-gray-500 dark:text-gray-400">Study preferences and account details.</p>

      <ApiKeyCard
        initialLast4={student.anthropic_key_last4}
        initialAddedAt={student.anthropic_key_added_at}
      />

      <SettingsForm
        studentId={student.id}
        initialName={student.name ?? ''}
        initialRwFocus={settings.rw_focus === true}
        initialHideFromLeaderboard={settings.hide_from_leaderboard === true}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The parent dashboard is protected by a PIN. To change it, unlock the{' '}
            <Link href="/parent" className="text-blue-600 hover:underline">
              parent dashboard
            </Link>{' '}
            with the current PIN first, then use the change-PIN option there. If the
            PIN is lost, it can be reset from the database (the{' '}
            <code className="rounded bg-gray-100 dark:bg-gray-800 px-1 text-xs">parent_access</code>{' '}
            row).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
