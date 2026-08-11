export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServerClient } from '@/lib/supabase';
import { SKILL_TAXONOMY } from '@/lib/types';
import { StudyLauncher } from '@/components/study-launcher';

export default async function StudyPage() {
  const supabase = createServerClient();

  // Load the first student (no auth yet)
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .limit(1)
    .single();

  // Load skill ratings
  const { data: skillRatings } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', student?.id ?? '');

  // Load recent sessions
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', student?.id ?? '')
    .order('started_at', { ascending: false })
    .limit(5);

  // Find lowest-rated sub-skill for auto-suggest
  const allSkills = [...SKILL_TAXONOMY.math, ...SKILL_TAXONOMY.reading_writing];
  const ratedSkills = (skillRatings ?? []).sort((a, b) => a.elo_rating - b.elo_rating);
  const lowestRated = ratedSkills[0]?.sub_skill_id ?? allSkills[0].id;

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold md:text-3xl">Study Session</h1>
      <p className="text-gray-500">
        Start an adaptive practice session. The AI will select questions based on
        your skill levels and focus on your weakest areas.
      </p>

      <StudyLauncher
        studentId={student?.id ?? ''}
        lowestRatedSkill={lowestRated}
        recentSessions={recentSessions ?? []}
      />
    </div>
  );
}
