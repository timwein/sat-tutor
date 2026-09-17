import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Dashboard notice for a student who has not added their own Anthropic API
 * key yet. AI features are gated on the key; everything else keeps working.
 */
export function NoApiKeyBanner() {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="space-y-1 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Add your Anthropic API key to unlock AI features</p>
            <p>
              AI tutoring, insights and drill generation run on your own Anthropic API key.
              Practice, streaks and review work without one.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/settings#api-key">Add your API key</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
