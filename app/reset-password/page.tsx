import { GraduationCap } from 'lucide-react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-800/60">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <GraduationCap className="h-10 w-10 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Choose a new password</h1>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
