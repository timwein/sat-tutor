import { createServerClient } from './supabase';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  milestoneReached: number | null;
}

export interface WeeklyStats {
  questionsAnswered: number;
  sessionsCompleted: number;
  accuracy: number | null;
  daysActive: number;
}

export interface ActivityDay {
  date: string;
  questionsAnswered: number;
  streakQualifying: boolean;
}

const MILESTONES = [7, 14, 30, 60, 90];

export async function computeCurrentStreak(studentId: string): Promise<StreakData> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('daily_activity')
    .select('activity_date, streak_qualifying')
    .eq('student_id', studentId)
    .eq('streak_qualifying', true)
    .order('activity_date', { ascending: false });

  const qualifyingDates = new Set(
    (data || []).map((d: { activity_date: string }) => d.activity_date)
  );

  // Walk backwards from today
  let currentStreak = 0;
  const today = new Date();
  const checkDate = new Date(today);

  // Check if today has activity; if not, start from yesterday
  const todayStr = checkDate.toISOString().split('T')[0];
  if (!qualifyingDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (qualifyingDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Compute longest streak
  const allDates = Array.from(qualifyingDates).sort();
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(allDates[i - 1]);
      const curr = new Date(allDates[i]);
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );
      tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // Check milestone
  const milestoneReached = MILESTONES.includes(currentStreak) ? currentStreak : null;

  return { currentStreak, longestStreak, milestoneReached };
}

export async function getWeeklyStats(studentId: string): Promise<WeeklyStats> {
  const supabase = createServerClient();

  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split('T')[0];

  // Daily activity for this week
  const { data: activityRows } = await supabase
    .from('daily_activity')
    .select('questions_answered, streak_qualifying')
    .eq('student_id', studentId)
    .gte('activity_date', mondayStr);

  const daysActive = (activityRows || []).length;
  const questionsAnswered = (activityRows || []).reduce(
    (sum: number, r: { questions_answered: number }) => sum + r.questions_answered,
    0
  );

  // Sessions completed this week
  const { count: sessionsCompleted } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .not('ended_at', 'is', null)
    .gte('started_at', monday.toISOString());

  // Accuracy this week
  const { count: totalAttempts } = await supabase
    .from('question_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('attempted_at', monday.toISOString());

  const { count: correctAttempts } = await supabase
    .from('question_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('is_correct', true)
    .gte('attempted_at', monday.toISOString());

  const accuracy =
    (totalAttempts ?? 0) > 0
      ? Math.round(((correctAttempts ?? 0) / (totalAttempts ?? 1)) * 100)
      : null;

  return {
    questionsAnswered,
    sessionsCompleted: sessionsCompleted ?? 0,
    accuracy,
    daysActive,
  };
}

export async function getActivityDays(
  studentId: string,
  months: number
): Promise<ActivityDay[]> {
  const supabase = createServerClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const startStr = startDate.toISOString().split('T')[0];

  const { data } = await supabase
    .from('daily_activity')
    .select('activity_date, questions_answered, streak_qualifying')
    .eq('student_id', studentId)
    .gte('activity_date', startStr)
    .order('activity_date', { ascending: true });

  return (data || []).map(
    (d: {
      activity_date: string;
      questions_answered: number;
      streak_qualifying: boolean;
    }) => ({
      date: d.activity_date,
      questionsAnswered: d.questions_answered,
      streakQualifying: d.streak_qualifying,
    })
  );
}
