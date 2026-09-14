import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');

  const params = await searchParams;
  const rawNext = params.next ?? '/';
  // Only allow same-origin relative paths: must start with a single "/" and not
  // "//" or "/\" (browsers resolve both to a foreign origin).
  const next = /^\/(?![\/\\])/.test(rawNext) ? rawNext : '/';
  const initialMode = params.mode === 'signup' ? 'signup' : 'signin';
  const inviteRequired = !!process.env.SIGNUP_INVITE_CODE;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-800/60">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <GraduationCap className="h-10 w-10 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SAT Tutor Pro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Adaptive SAT practice with an AI tutor that learns how you think.
          </p>
        </div>
        {params.error === 'link' && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            That sign-in link is invalid or has expired. Please try again.
          </p>
        )}
        <AuthForm next={next} initialMode={initialMode} inviteRequired={inviteRequired} />
      </div>
    </div>
  );
}
