'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SettingsFormProps {
  studentId: string;
  initialName: string;
  initialRwFocus: boolean;
}

export function SettingsForm({ studentId, initialName, initialRwFocus }: SettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [rwFocus, setRwFocus] = useState(initialRwFocus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, name, rw_focus: rwFocus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save. Please try again.');
      } else {
        setMessage('Saved.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="student-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <Input
              id="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shown in the dashboard greeting and parent reports.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Study Focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={rwFocus}
              onChange={(e) => setRwFocus(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-700"
            />
            <span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                Focus on Reading &amp; Writing
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                Mixed study sessions will lean heavily toward Reading &amp; Writing
                questions (roughly 3 of every 4). Quick drills and practice tests are
                unaffected.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {message && <span className="text-sm text-green-700 dark:text-green-400">{message}</span>}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
