'use client';

import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Posts to /api/auth/signout, which clears the session cookie and redirects to /login. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form method="post" action="/api/auth/signout">
      <button
        type="submit"
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
          className
        )}
      >
        <LogOut className="h-5 w-5" />
        Sign out
      </button>
    </form>
  );
}
