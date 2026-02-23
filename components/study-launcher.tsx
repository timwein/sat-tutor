'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Zap, Clock, Target } from 'lucide-react';
import { SKILL_TAXONOMY } from '@/lib/types';
import type { Session } from '@/lib/types';

interface StudyLauncherProps {
  studentId: string;
  lowestRatedSkill: string;
  recentSessions: Session[];
}

const allSkills = [
  ...SKILL_TAXONOMY.math.map((s) => ({ ...s, section: 'math' as const })),
  ...SKILL_TAXONOMY.reading_writing.map((s) => ({ ...s, section: 'reading_writing' as const })),
];

export function StudyLauncher({ studentId, lowestRatedSkill, recentSessions }: StudyLauncherProps) {
  const router = useRouter();
  const [selectedSkill, setSelectedSkill] = useState(lowestRatedSkill);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSession(type: 'quick_drill' | 'study_session') {
    setIsStarting(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        student_id: studentId,
        session_type: type,
      };
      if (type === 'quick_drill') {
        body.sub_skill_focus = selectedSkill;
      }

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to create session');

      const { session } = await res.json();
      router.push(`/study/${session.id}`);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Failed to start session. Please try again.');
      setIsStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Drill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              10 questions, ~10 minutes. Focus on one sub-skill.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Sub-skill focus</label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500">Math</div>
                  {SKILL_TAXONOMY.math.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.id}: {skill.name}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500">Reading & Writing</div>
                  {SKILL_TAXONOMY.reading_writing.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id}>
                      {skill.id}: {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => startSession('quick_drill')}
              disabled={isStarting}
              className="w-full"
            >
              {isStarting ? 'Starting...' : 'Start Quick Drill'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Full Study Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              25-45 minutes. Mixed sub-skills with adaptive difficulty and
              AI-powered explanations.
            </p>
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              The AI will automatically select questions based on your weakest
              skills and adjust difficulty as you go.
            </div>
            <Button
              onClick={() => startSession('study_session')}
              disabled={isStarting}
              className="w-full"
            >
              {isStarting ? 'Starting...' : 'Start Study Session'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {session.session_type === 'quick_drill' ? 'Quick Drill' : 'Study Session'}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {new Date(session.started_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Target className="h-4 w-4" />
                      {session.questions_answered} questions
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <Clock className="h-4 w-4" />
                      {session.accuracy != null ? `${Math.round(session.accuracy * 100)}%` : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
