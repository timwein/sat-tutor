'use client';

import Link from 'next/link';
import { ArrowUp, ArrowDown, ArrowRight, Lightbulb, Target } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InsightItem } from '@/lib/types';
import { EvidenceList, type EvidenceMap } from '@/components/evidence-list';

interface InsightCardProps {
  insight: InsightItem;
  index: number;
  evidenceMap?: EvidenceMap;
}

/**
 * Resolve the sub-skill a targeted drill should focus on: prefer a skill id
 * mentioned in the finding/recommendation text, else the dominant skill among
 * the evidence questions.
 */
function resolveFocusSkill(insight: InsightItem, evidenceMap: EvidenceMap): string | null {
  const text = `${insight.finding} ${insight.recommendation}`;
  const mentioned = text.match(/\b(M|RW)-\d{2}\b/);
  if (mentioned) return mentioned[0];

  const counts = new Map<string, number>();
  for (const id of insight.evidence_question_ids ?? []) {
    const q = evidenceMap[id];
    if (q) counts.set(q.sub_skill_id, (counts.get(q.sub_skill_id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [skill, count] of counts) {
    if (count > bestCount) { best = skill; bestCount = count; }
  }
  return best;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300',
  medium: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
  low: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
};

function TrendIndicator({ trend }: { trend: InsightItem['trend'] }) {
  switch (trend) {
    case 'improving':
      return (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <ArrowUp className="h-4 w-4" />
          Improving
        </span>
      );
    case 'worsening':
      return (
        <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
          <ArrowDown className="h-4 w-4" />
          Worsening
        </span>
      );
    case 'stagnant':
    default:
      return (
        <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <ArrowRight className="h-4 w-4" />
          Stagnant
        </span>
      );
  }
}

export function InsightCard({ insight, index, evidenceMap }: InsightCardProps) {
  const focusSkill = resolveFocusSkill(insight, evidenceMap ?? {});
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <CardTitle>Insight #{index}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(SEVERITY_STYLES[insight.severity])}
            >
              {insight.severity}
            </Badge>
            <TrendIndicator trend={insight.trend} />
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{insight.dimension}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">{insight.finding}</p>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">Recommendation: </span>
            {insight.recommendation}
          </p>
        </div>

        <div className="flex items-start gap-1">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
          <EvidenceList
            questionIds={insight.evidence_question_ids}
            evidenceMap={evidenceMap ?? {}}
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href={focusSkill ? `/study?focus=${focusSkill}` : '/study'}>
            {focusSkill ? `Start Targeted Drill (${focusSkill})` : 'Start Targeted Drill'}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
