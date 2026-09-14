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
            The parent dashboard is protected by a PIN, created the first time the{' '}
            <Link href="/parent" className="text-blue-600 hover:underline">
              parent dashboard
            </Link>{' '}
            is opened. If the PIN is lost, ask an admin to reset it; you will then be
            prompted to create a new one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
