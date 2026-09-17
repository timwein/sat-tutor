import { createServerClient } from './supabase';
import { computeCurrentStreak, getWeeklyStats } from './streak-calculator';

export interface LeaderboardRow {
  studentId: string;
  displayName: string;
  currentStreak: number;
  longestStreak: number;
  questionsThisWeek: number;
  accuracyThisWeek: number | null;
  daysActiveThisWeek: number;
}

interface LeaderboardStudent {
  id: string;
  name: string;
  settings: Record<string, unknown> | null;
}

/** First word of a student's name, used on the shared leaderboard. */
export function leaderboardDisplayName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || 'Student';
}

/**
 * Every student who has not opted out (settings.hide_from_leaderboard),
 * ranked by current streak, then questions this week, then longest streak.
 * Remaining ties keep sign-up order (earliest member first) so the ranking
 * is stable between loads.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = createServerClient();

  // Ordered so the stable sort below breaks ties deterministically.
  const { data } = await supabase
    .from('students')
    .select('id, name, settings')
    .order('created_at', { ascending: true });

  const students = ((data ?? []) as LeaderboardStudent[]).filter(
    (s) => s.settings?.hide_from_leaderboard !== true
  );

  const rows = await Promise.all(
    students.map(async (s): Promise<LeaderboardRow> => {
      const [streak, weekly] = await Promise.all([
        computeCurrentStreak(s.id),
        getWeeklyStats(s.id),
      ]);
      return {
        studentId: s.id,
        displayName: leaderboardDisplayName(s.name),
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        questionsThisWeek: weekly.questionsAnswered,
        accuracyThisWeek: weekly.accuracy,
        daysActiveThisWeek: weekly.daysActive,
      };
    })
  );

  rows.sort(
    (a, b) =>
      b.currentStreak - a.currentStreak ||
      b.questionsThisWeek - a.questionsThisWeek ||
      b.longestStreak - a.longestStreak
  );

  return rows;
}
