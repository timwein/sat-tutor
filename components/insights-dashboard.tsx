'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Clock, Lightbulb, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InsightCard } from '@/components/insight-card';
import { DimensionDetail } from '@/components/dimension-detail';
import type { WrongAnswerInsight } from '@/lib/types';

interface InsightsDashboardProps {
  insight: WrongAnswerInsight;
  wrongAnswerCount: number;
  studentId: string;
}

const DIMENSION_MAP: Record<string, string> = {
  error_type_distribution: 'Error Types',
  sub_skill_clustering: 'Sub-Skill Clusters',
  distractor_analysis: 'Distractor Patterns',
  question_structure: 'Question Structure',
  time_patterns: 'Time Patterns',
  cross_topic_interaction: 'Cross-Topic Effects',
  reading_sub_patterns: 'Reading Patterns',
  confidence_calibration: 'Confidence Calibration',
};

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMinutes > 0)
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

export function InsightsDashboard({
  insight,
  wrongAnswerCount,
  studentId,
}: InsightsDashboardProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentInsight, setCurrentInsight] =
    useState<WrongAnswerInsight>(insight);
  const [selectedDimension] = useState<string>(
    Object.keys(DIMENSION_MAP)[0]
  );

  const canRefresh =
    wrongAnswerCount > currentInsight.total_wrong_answers_analyzed;

  async function handleRefresh() {
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentInsight(data);
        router.refresh();
      }
    } catch {
      // Silently handle error — user can retry
    } finally {
      setIsRegenerating(false);
    }
  }

  const dimensionKeys = Object.keys(DIMENSION_MAP);

  return (
    <div className="space-y-6">
      {/* Header with metadata and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>
            Generated {formatRelativeTime(currentInsight.generated_at)} from{' '}
            {currentInsight.total_wrong_answers_analyzed} wrong answers
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={!canRefresh || isRegenerating}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`}
          />
          {isRegenerating ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </div>

      {!canRefresh && (
        <p className="text-xs text-gray-400">
          New analysis available after more wrong answers are recorded.
        </p>
      )}

      <Separator />

      {/* Top Insights */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-semibold">Top Insights</h2>
        </div>
        <div className="space-y-4">
          {currentInsight.top_insights.map((item, i) => (
            <InsightCard key={item.dimension + i} insight={item} index={i + 1} />
          ))}
        </div>
      </div>

      <Separator />

      {/* Deep Dive */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Deep Dive</h2>
        </div>

        <Tabs defaultValue={selectedDimension}>
          <TabsList className="flex flex-wrap">
            {dimensionKeys.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {DIMENSION_MAP[key]}
              </TabsTrigger>
            ))}
          </TabsList>
          {dimensionKeys.map((key) => (
            <TabsContent key={key} value={key}>
              <DimensionDetail
                dimensionKey={key}
                dimensionLabel={DIMENSION_MAP[key]}
                detail={currentInsight.dimension_details?.[key] ?? null}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
