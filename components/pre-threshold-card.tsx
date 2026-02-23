'use client';

import Link from 'next/link';
import { Brain } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface PreThresholdCardProps {
  wrongAnswerCount: number;
  threshold: number;
}

const DIMENSION_LABELS = [
  'Error Type Classification',
  'Sub-Skill Clustering',
  'Distractor Analysis',
  'Question Structure',
  'Time-Based Patterns',
  'Cross-Topic Interaction',
  'Reading Sub-Patterns',
  'Confidence Calibration',
];

export function PreThresholdCard({
  wrongAnswerCount,
  threshold,
}: PreThresholdCardProps) {
  const progressValue = Math.min((wrongAnswerCount / threshold) * 100, 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-600" />
          <CardTitle>Building Your Error Profile</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          The AI is collecting data on your mistakes to find hidden patterns.
          Insights will be available after {threshold} wrong answers.
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">
              {wrongAnswerCount} / {threshold}
            </span>
          </div>
          <Progress value={progressValue} className="h-3" />
        </div>

        <div className="pt-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Dimensions analyzed:
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            {DIMENSION_LABELS.map((label, i) => (
              <span key={label}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Keep practicing — every wrong answer teaches the AI more about how to
          help you.
        </p>
      </CardContent>

      <CardFooter>
        <Button asChild className="w-full">
          <Link href="/study">Start a Practice Session</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
