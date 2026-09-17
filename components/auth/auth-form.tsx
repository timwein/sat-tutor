'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBrowserAuthClient } from '@/lib/supabase-browser';
import { readApiError, apiErrorMessage } from '@/lib/api-errors';

type Mode = 'signin' | 'signup' | 'forgot';

interface AuthFormProps {
  next: string;
  initialMode: 'signin' | 'signup';
  inviteRequired: boolean;
}

export function AuthForm({ next, initialMode, inviteRequired }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function signIn() {
    const supabase = createBrowserAuthClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(
        /invalid login credentials/i.test(signInError.message)
          ? 'Wrong email or password.'
          : signInError.message
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function signUp() {
    if (inviteRequired) {
      // The invite code is the trust boundary: the server creates a confirmed
      // account and we sign straight in.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.trim(), password, invite_code: inviteCode }),
      });
      if (!res.ok) {
        setError(apiErrorMessage(await readApiError(res), 'Could not create the account.'));
        return;
      }
      await signIn();
      return;
    }

    // Open sign-up: Supabase owns it and (when "Confirm email" is on) sends
    // the confirmation link, which lands on /auth/callback.
    const supabase = createBrowserAuthClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (signUpError) {
      setError(
        /already registered|already exists/i.test(signUpError.message)
          ? 'An account with that email already exists. Sign in instead.'
          : signUpError.message
      );
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    setNotice('Check your email for a confirmation link, then come back and sign in.');
  }

  async function sendReset() {
    const supabase = createBrowserAuthClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice('If that email has an account, a reset link is on its way. Check your inbox.');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') await signIn();
      else if (mode === 'signup') await signUp();
      else await sendReset();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset password';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1">
              <label htmlFor="auth-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Your name
              </label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                maxLength={80}
              />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="auth-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1">
              <label htmlFor="auth-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
              />
              {mode === 'signup' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">At least 8 characters.</p>
              )}
            </div>
          )}

          {mode === 'signup' && inviteRequired && (
            <div className="space-y-1">
              <label htmlFor="auth-invite" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Invite code
              </label>
              <Input
                id="auth-invite"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {notice && <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? 'Working...'
              : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
          </Button>

          <div className="flex flex-col gap-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {mode === 'signin' && (
              <>
                <button type="button" className="underline" onClick={() => switchMode('signup')}>
                  New here? Create an account
                </button>
                <button type="button" className="underline" onClick={() => switchMode('forgot')}>
                  Forgot your password?
                </button>
              </>
            )}
            {mode !== 'signin' && (
              <button type="button" className="underline" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
