'use client';

import { useState } from 'react';
import type { Session } from '@/lib/types';
import { SKILL_TAXONOMY } from '@/lib/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface SessionHistoryProps {
  sessions: Session[];
}

const SESSION_TYPE_STYLES: Record<
  Session['session_type'],
  { label: string; className: string }
> = {
  study_session: {
    label: 'Study Session',
    className: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200',
  },
  quick_drill: {
    label: 'Quick Drill',
    className: 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border-green-200',
  },
  timed_section: {
    label: 'Timed Section',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  full_practice_test: {
    label: 'Practice Test',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
};

// Build skill name lookup
const allSkills = [...SKILL_TAXONOMY.reading_writing, ...SKILL_TAXONOMY.math];
const skillNameMap = new Map<string, string>();
for (const s of allSkills) skillNameMap.set(s.id, s.name);

export function SessionHistory({ sessions }: SessionHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(sessionId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        No sessions yet. Start a study session to see your history here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const typeInfo = SESSION_TYPE_STYLES[session.session_type];
        const start = new Date(session.started_at);
        const end = session.ended_at ? new Date(session.ended_at) : null;
        const durationMinutes = end
          ? Math.round((end.getTime() - start.getTime()) / (1000 * 60))
          : null;
        const formattedDate = new Date(session.started_at).toLocaleDateString(
          'en-US',
          { month: 'short', day: 'numeric', year: 'numeric' }
        );
        const accuracy =
          session.accuracy !== null
            ? `${Math.round(session.accuracy * 100)}%`
            : session.questions_answered > 0
              ? `${Math.round((session.questions_correct / session.questions_answered) * 100)}%`
              : '--';
        const isExpanded = expandedIds.has(session.id);
        const topicNames = session.sub_skills_practiced
          .map((id) => skillNameMap.get(id) ?? id)
          .filter(Boolean);

        return (
          <Card key={session.id}>
            <CardHeader className="pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={typeInfo.className}
                >
                  {typeInfo.label}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</span>
                {durationMinutes !== null && (
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="size-3.5" />
                    {durationMinutes} min
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span>
                  <span className="font-semibold">{session.questions_correct}</span>
                  <span className="text-gray-500 dark:text-gray-400">/{session.questions_answered} correct</span>
                </span>
                <span>
                  <span className="font-semibold">{accuracy}</span>
                  <span className="text-gray-500 dark:text-gray-400"> accuracy</span>
                </span>
              </div>

              {/* Topics practiced */}
              {topicNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {topicNames.map((name) => (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="text-xs"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Summary */}
              {session.summary && (
                <div>
                  <p
                    className={
                      isExpanded
                        ? 'text-sm text-gray-600 dark:text-gray-300'
                        : 'line-clamp-2 text-sm text-gray-600 dark:text-gray-300'
                    }
                  >
                    {session.summary}
                  </p>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1 text-gray-500 dark:text-gray-400"
                    onClick={() => toggleExpanded(session.id)}
                  >
                    {isExpanded ? (
                      <>
                        Show less <ChevronUp className="size-3" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="size-3" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
