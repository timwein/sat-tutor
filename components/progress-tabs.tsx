'use client';

import { useState } from 'react';
import type { SkillRating, Session } from '@/lib/types';
import type { ActivityDay, StreakData } from '@/lib/streak-calculator';
import { SkillMap } from './skill-map';
import { SkillDetailPanel } from './skill-detail-panel';
import { SessionHistory } from './session-history';
import { ActivityHeatmap } from './activity-heatmap';
import { StreakDisplay } from './streak-display';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface ProgressTabsProps {
  skillRatings: SkillRating[];
  sessions: Session[];
  activityDays: ActivityDay[];
  streakData: StreakData;
  studentId: string;
}

export function ProgressTabs({
  skillRatings,
  sessions,
  activityDays,
  streakData,
  studentId,
}: ProgressTabsProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDetailOpen, setSkillDetailOpen] = useState(false);

  function handleSkillClick(skillId: string) {
    setSelectedSkillId(skillId);
    setSkillDetailOpen(true);
  }

  return (
    <Tabs defaultValue="skill-map">
      <TabsList>
        <TabsTrigger value="skill-map">Skill Map</TabsTrigger>
        <TabsTrigger value="session-history">Session History</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="skill-map">
        <SkillMap
          skillRatings={skillRatings}
          onSkillClick={handleSkillClick}
          showTree
        />
        <SkillDetailPanel
          open={skillDetailOpen}
          onClose={() => setSkillDetailOpen(false)}
          skillId={selectedSkillId}
          studentId={studentId}
        />
      </TabsContent>

      <TabsContent value="session-history">
        <SessionHistory sessions={sessions} />
      </TabsContent>

      <TabsContent value="activity">
        <StreakDisplay streak={streakData} />
        <ActivityHeatmap activityDays={activityDays} />
      </TabsContent>
    </Tabs>
  );
}
