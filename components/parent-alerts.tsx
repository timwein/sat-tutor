'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarX2, TrendingDown, Trophy } from 'lucide-react';
import type { ParentAlert } from '@/lib/types';

interface ParentAlertsProps {
  alerts: ParentAlert[];
  onAlertDismissed: (alertId: string) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200',
  warning: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200',
  critical: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200',
};

const ALERT_TYPE_ICONS: Record<string, typeof CalendarX2> = {
  study_gap: CalendarX2,
  skill_regression: TrendingDown,
  milestone: Trophy,
};

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ParentAlerts({ alerts, onAlertDismissed }: ParentAlertsProps) {
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  async function handleDismiss(alertId: string) {
    setDismissingIds((prev) => new Set(prev).add(alertId));

    try {
      const res = await fetch('/api/parent/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });

      if (res.ok) {
        onAlertDismissed(alertId);
      }
    } catch {
      // Failed silently
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Trophy className="mb-4 h-12 w-12 text-green-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          No alerts - everything looks great!
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          We&apos;ll notify you about study gaps, skill regressions, and
          milestones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const Icon = ALERT_TYPE_ICONS[alert.alert_type] ?? CalendarX2;
        const isDismissing = dismissingIds.has(alert.id);

        return (
          <Card key={alert.id}>
            <CardContent className="flex items-start gap-4 pt-4">
              <div className="mt-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 p-2">
                <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={SEVERITY_STYLES[alert.severity] ?? ''}
                  >
                    {alert.severity}
                  </Badge>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {getRelativeTime(alert.created_at)}
                  </span>
                </div>
                <h4 className="text-sm font-medium">{alert.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">{alert.description}</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(alert.id)}
                disabled={isDismissing}
                className="shrink-0 text-gray-500 dark:text-gray-400"
              >
                {isDismissing ? 'Dismissing...' : 'Dismiss'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
