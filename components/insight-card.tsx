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

interface InsightCardProps {
  insight: InsightItem;
  index: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
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
        <span className="flex items-center gap-1 text-sm text-red-600">
          <ArrowDown className="h-4 w-4" />
          Worsening
        </span>
      );
    case 'stagnant':
    default:
      return (
        <span className="flex items-center gap-1 text-sm text-gray-500">
          <ArrowRight className="h-4 w-4" />
          Stagnant
        </span>
      );
  }
}

export function InsightCard({ insight, index }: InsightCardProps) {
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
        <p className="text-sm text-gray-500">{insight.dimension}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-700">{insight.finding}</p>

        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Recommendation: </span>
            {insight.recommendation}
          </p>
        </div>

        <p className="flex items-center gap-1 text-xs text-gray-500">
          <Target className="h-3.5 w-3.5" />
          Based on {insight.evidence_question_ids.length} questions
        </p>
      </CardContent>

      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href="/study">Start Targeted Drill</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
