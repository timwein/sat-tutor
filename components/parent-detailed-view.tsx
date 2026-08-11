'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SessionHistory } from './session-history';
import { SKILL_TAXONOMY } from '@/lib/types';
import { getMasteryLevel } from '@/lib/elo';
import type { ParentDashboardData } from '@/lib/parent-dashboard';
import type { SkillRating } from '@/lib/types';

interface ParentDetailedViewProps {
  data: ParentDashboardData;
  allSkillRatings: SkillRating[];
}

const LINE_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
];

const MASTERY_BADGE_STYLES: Record<string, string> = {
  Developing: 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200',
  Progressing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Proficient: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200',
  Mastered: 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 border-green-200',
};

const allSkills = [...SKILL_TAXONOMY.reading_writing, ...SKILL_TAXONOMY.math];
const skillMap = new Map<string, (typeof allSkills)[number]>(
  allSkills.map((s) => [s.id, s])
);

export function ParentDetailedView({
  data,
  allSkillRatings,
}: ParentDetailedViewProps) {
  const { errorRateByTopic, recentSessions } = data;

  // Transform error rate data for recharts
  // We need: [{ weekLabel: 'Jan 6', 'Skill A': 30, 'Skill B': 45, ... }, ...]
  const weekLabels =
    errorRateByTopic.length > 0
      ? errorRateByTopic[0].weeks.map((w) => w.weekLabel)
      : [];

  const chartData = weekLabels.map((weekLabel, i) => {
    const point: Record<string, string | number> = { week: weekLabel };
    for (const skill of errorRateByTopic) {
      point[skill.skillName] = skill.weeks[i]?.errorRate ?? 0;
    }
    return point;
  });

  // Sort skill ratings by section then elo
  const sortedRatings = [...allSkillRatings].sort((a, b) => {
    const aSkill = skillMap.get(a.sub_skill_id);
    const bSkill = skillMap.get(b.sub_skill_id);
    const aSection = aSkill?.id.startsWith('RW') ? 0 : 1;
    const bSection = bSkill?.id.startsWith('RW') ? 0 : 1;
    if (aSection !== bSection) return aSection - bSection;
    return a.sub_skill_id.localeCompare(b.sub_skill_id);
  });

  return (
    <div className="space-y-6">
      {/* Error Rate Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Error Rate Over Time</CardTitle>
          <CardDescription>
            Weekly error rates for the top 5 most-practiced skills (last 8
            weeks)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorRateByTopic.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Not enough data to display error rate trends yet.
            </p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" fontSize={12} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(val: number) => `${val}%`}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  {errorRateByTopic.map((skill, idx) => (
                    <Line
                      key={skill.skillId}
                      type="monotone"
                      dataKey={skill.skillName}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Skill Ratings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Skill Ratings</CardTitle>
          <CardDescription>
            Complete view of all 30 SAT sub-skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedRatings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No skill ratings available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                      Skill
                    </th>
                    <th className="pb-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                      Domain
                    </th>
                    <th className="pb-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                      Elo
                    </th>
                    <th className="pb-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                      Accuracy
                    </th>
                    <th className="pb-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                      Mastery
                    </th>
                    <th className="pb-2 font-medium text-gray-700 dark:text-gray-300">
                      Questions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRatings.map((rating) => {
                    const skill = skillMap.get(rating.sub_skill_id);
                    const accuracy =
                      rating.questions_attempted > 0
                        ? Math.round(
                            (rating.questions_correct /
                              rating.questions_attempted) *
                              100
                          )
                        : 0;
                    const mastery = getMasteryLevel(rating.elo_rating);

                    return (
                      <tr
                        key={rating.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="py-2 pr-4 font-medium">
                          {skill?.name ?? rating.sub_skill_id}
                        </td>
                        <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                          {skill?.domain ?? 'Unknown'}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {rating.elo_rating}
                        </td>
                        <td className="py-2 pr-4">{accuracy}%</td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant="outline"
                            className={
                              MASTERY_BADGE_STYLES[mastery] ?? ''
                            }
                          >
                            {mastery}
                          </Badge>
                        </td>
                        <td className="py-2">
                          {rating.questions_attempted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Last 10 completed study sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionHistory sessions={recentSessions} />
        </CardContent>
      </Card>
    </div>
  );
}
