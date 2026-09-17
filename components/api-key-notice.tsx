'use client';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { API_KEY_ERROR_CODES } from '@/lib/api-errors';
import { cn } from '@/lib/utils';

interface ApiKeyNoticeProps {
  /** Error code from an API response ({ error, code }). */
  code?: string | null;
  /** Message from the API response. */
  message?: string | null;
  className?: string;
}

/**
 * Inline notice for AI features that failed because of the student's own
 * Anthropic API key (missing, rejected, out of credit, rate limited). Points
 * at Settings, where the key is managed. Renders nothing for other errors.
 */
export function ApiKeyNotice({ code, message, className }: ApiKeyNoticeProps) {
  if (!code || !API_KEY_ERROR_CODES.has(code)) return null;

  const showSettingsLink = code !== 'rate_limited';

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
        className
      )}
    >
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p>{message ?? 'Add your Anthropic API key in Settings to use AI features.'}</p>
        {showSettingsLink && (
          <Link href="/settings#api-key" className="font-medium underline">
            Open Settings
          </Link>
        )}
      </div>
    </div>
  );
}
