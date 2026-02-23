'use client';

import { ArrowUp, ArrowDown, ArrowRight, Target } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DimensionDetail as DimensionDetailType } from '@/lib/types';

interface DimensionDetailProps {
  dimensionKey: string;
  dimensionLabel: string;
  detail: DimensionDetailType | null | undefined;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

function TrendIndicator({ trend }: { trend: DimensionDetailType['trend'] }) {
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

export function DimensionDetail({
  dimensionKey,
  dimensionLabel,
  detail,
}: DimensionDetailProps) {
  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{dimensionLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No data available for this dimension.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{dimensionLabel}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(SEVERITY_STYLES[detail.severity])}
            >
              {detail.severity}
            </Badge>
            <TrendIndicator trend={detail.trend} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-700">{detail.finding}</p>

        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Recommendation: </span>
            {detail.recommendation}
          </p>
        </div>

        <p className="flex items-center gap-1 text-xs text-gray-500">
          <Target className="h-3.5 w-3.5" />
          Based on {detail.evidence_question_ids.length} questions
        </p>
      </CardContent>
    </Card>
  );
}
