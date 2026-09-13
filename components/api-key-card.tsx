'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { readApiError, apiErrorMessage } from '@/lib/api-errors';

interface ApiKeyCardProps {
  initialLast4: string | null;
  initialAddedAt: string | null;
}

interface RequestError {
  code?: string;
  message: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Settings card for the student's own Anthropic API key (add, replace, remove). */
export function ApiKeyCard({ initialLast4, initialAddedAt }: ApiKeyCardProps) {
  const [last4, setLast4] = useState<string | null>(initialLast4);
  const [addedAt, setAddedAt] = useState<string | null>(initialAddedAt);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<RequestError | null>(null);

  const hasKey = !!last4;
  const busy = saving || removing;

  async function saveKey() {
    if (apiKey.trim().length === 0) {
      setError({ message: 'Paste your Anthropic API key first.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });
      if (!res.ok) {
        const body = await readApiError(res);
        setError({
          code: body.code,
          message: apiErrorMessage(body, 'Failed to save your key. Please try again.'),
        });
        return;
      }
      const data = (await res.json()) as { last4?: string; added_at?: string };
      setLast4(data.last4 ?? apiKey.trim().slice(-4));
      setAddedAt(data.added_at ?? new Date().toISOString());
      setApiKey('');
      setMessage('Key saved. AI features are ready to go.');
    } catch {
      setError({ message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    setRemoving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/settings/api-key', { method: 'DELETE' });
      if (!res.ok) {
        const body = await readApiError(res);
        setError({
          code: body.code,
          message: apiErrorMessage(body, 'Failed to remove your key. Please try again.'),
        });
        return;
      }
      setLast4(null);
      setAddedAt(null);
      setMessage('Key removed.');
    } catch {
      setError({ message: 'Network error. Please try again.' });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card id="api-key" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Anthropic API Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {hasKey ? (
            <>
              Key ending in <span className="font-mono">&bull;&bull;&bull;&bull;{last4}</span>
              {addedAt ? `, added ${formatDate(addedAt)}` : ''}.
            </>
          ) : (
            'No key on file. AI tutoring, insights and drill generation are off until you add one.'
          )}
        </p>

        <div className="space-y-1">
          <label htmlFor="anthropic-api-key" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {hasKey ? 'Replace key' : 'Paste your key'}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="anthropic-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={busy}
              className="max-w-md"
            />
            <Button onClick={saveKey} disabled={busy || apiKey.trim().length === 0}>
              {saving ? 'Checking key...' : 'Save key'}
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            Get a key at{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              console.anthropic.com/settings/keys
            </a>
            . Your Anthropic account needs prepaid credits (the minimum purchase is small).
          </p>
          <p>
            Your key is stored encrypted and only ever used for your own requests. Typical
            usage costs roughly a dollar per study session.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasKey && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  {removing ? 'Removing...' : 'Remove key'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove your API key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    AI tutoring, insights and drill generation will stop working until you add
                    a key again. Practice, streaks and review keep working.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep key</AlertDialogCancel>
                  <AlertDialogAction onClick={removeKey}>Remove key</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {message && <span className="text-sm text-green-700 dark:text-green-400">{message}</span>}
          {error && (
            <span className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error.message}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
