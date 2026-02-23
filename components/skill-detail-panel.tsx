'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SKILL_TAXONOMY } from '@/lib/types';
import { getMasteryLevel } from '@/lib/elo';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface SkillDetailPanelProps {
  skillId: string | null;
  open: boolean;
  onClose: () => void;
  studentId: string;
}

interface AttemptRecord {
  question_id: string;
  is_correct: boolean;
  time_spent_seconds: number | null;
  attempted_at: string;
}

interface SkillDetailData {
  elo_rating: number;
  questions_attempted: number;
  questions_correct: number;
  is_calibrated: boolean;
  recent_attempts: AttemptRecord[];
}

const ALL_SKILLS = [
  ...SKILL_TAXONOMY.reading_writing,
  ...SKILL_TAXONOMY.math,
];

const MASTERY_BADGE_STYLES: Record<string, string> = {
  Developing: 'bg-red-100 text-red-700',
  Progressing: 'bg-amber-100 text-amber-700',
  Proficient: 'bg-blue-100 text-blue-700',
  Mastered: 'bg-green-100 text-green-700',
};

function lookupSkill(skillId: string) {
  return ALL_SKILLS.find((s) => s.id === skillId) ?? null;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(seconds: number | null) {
  if (seconds === null) return '--';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function SkillDetailPanel({
  skillId,
  open,
  onClose,
  studentId,
}: SkillDetailPanelProps) {
  const [data, setData] = useState<SkillDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!skillId || !open) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/skill-detail?student_id=${encodeURIComponent(studentId)}&sub_skill_id=${encodeURIComponent(skillId)}`
    )
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load skill details');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [skillId, studentId, open]);

  const skill = skillId ? lookupSkill(skillId) : null;
  const mastery = data ? getMasteryLevel(data.elo_rating) : null;
  const accuracy =
    data && data.questions_attempted > 0
      ? Math.round((data.questions_correct / data.questions_attempted) * 100)
      : null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{skill?.name ?? 'Skill Detail'}</SheetTitle>
          {skill && (
            <SheetDescription>{skill.domain}</SheetDescription>
          )}
        </SheetHeader>

        <div className="px-4 pb-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {data && !loading && (
            <>
              {/* Elo + Mastery Badge */}
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">{data.elo_rating}</span>
                {mastery && (
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                      MASTERY_BADGE_STYLES[mastery]
                    )}
                  >
                    {mastery}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Attempted</p>
                  <p className="text-lg font-semibold">{data.questions_attempted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Correct</p>
                  <p className="text-lg font-semibold">{data.questions_correct}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                  <p className="text-lg font-semibold">
                    {accuracy !== null ? `${accuracy}%` : '--'}
                  </p>
                </div>
              </div>

              {/* Recent Attempts */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  Recent Attempts
                </h3>
                {data.recent_attempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No attempts yet for this skill
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.recent_attempts.map((attempt, i) => (
                      <div
                        key={`${attempt.question_id}-${i}`}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {attempt.is_correct ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-mono">
                            {attempt.question_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatTime(attempt.time_spent_seconds)}</span>
                          <span>{formatDate(attempt.attempted_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
