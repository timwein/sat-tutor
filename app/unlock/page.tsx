'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function UnlockPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function unlock() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Incorrect password.');
        setBusy(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white dark:bg-gray-900 p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <GraduationCap className="h-10 w-10 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">SAT Tutor Pro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter the family password to continue.</p>
        </div>
        <div className="space-y-3">
          <label htmlFor="app-password" className="sr-only">
            Password
          </label>
          <Input
            id="app-password"
            type="password"
            value={password}
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') unlock();
            }}
            autoFocus
          />
          <Button onClick={unlock} disabled={busy || !password} className="w-full">
            {busy ? 'Unlocking...' : 'Unlock'}
          </Button>
          {error && (
            <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
