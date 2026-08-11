import { createServerClient } from './supabase';
import { SKILL_TAXONOMY } from './types';
import { getMasteryLevel } from './elo';
import type {
  SkillRating,
  Session,
  ScorePrediction,
  ParentAlert,
} from './types';

// ============================================
// Dashboard data interface
// ============================================

export interface ParentDashboardData {
  scorePrediction: ScorePrediction | null;
  scoreTrend: { delta: number; direction: 'up' | 'down' | 'flat' } | null;
  studyTime: { thisWeekMinutes: number; thisMonthMinutes: number };
  sessionFrequency: { thisWeek: number; thisMonth: number };
  topWeaknesses: Array<{
    skillId: string;
    skillName: string;
    domain: string;
    elo: number;
    accuracy: number;
    mastery: string;
  }>;
  alerts: ParentAlert[];
  errorRateByTopic: Array<{
    skillId: string;
    skillName: string;
    weeks: Array<{ weekLabel: string; errorRate: number; attempts: number }>;
  }>;
  recentSessions: Session[];
  allSkillRatings: SkillRating[];
}

// ============================================
// Helpers
// ============================================

const allSkills = [...SKILL_TAXONOMY.reading_writing, ...SKILL_TAXONOMY.math];
const skillMap = new Map<string, (typeof allSkills)[number]>(
  allSkills.map((s) => [s.id, s])
);

/** Get Monday 00:00 of the current week (local-ish, using UTC) */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Get first day of the current month (UTC) */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Get the ISO week label for a date, e.g. "Jan 6" */
function getWeekLabel(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  // Find the Monday of this date's week
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ============================================
// Main data fetcher
// ============================================

export async function getParentDashboardData(
  studentId: string
): Promise<ParentDashboardData> {
  const supabase = createServerClient();

  // 1. Score prediction + trend
  const { data: predictions } = await supabase
    .from('score_predictions')
    .select('*')
    .eq('student_id', studentId)
    .order('predicted_at', { ascending: false })
    .limit(2);

  const predList = (predictions ?? []) as ScorePrediction[];
  const scorePrediction = predList[0] ?? null;
  let scoreTrend: ParentDashboardData['scoreTrend'] = null;

  if (predList.length >= 2) {
    const delta = predList[0].total_score_mid - predList[1].total_score_mid;
    scoreTrend = {
      delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    };
  }

  // 2. Study time
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  const { data: completedSessions } = await supabase
    .from('sessions')
    .select('started_at, ended_at')
    .eq('student_id', studentId)
    .not('ended_at', 'is', null)
    .gte('started_at', monthStart.toISOString())
    .order('started_at', { ascending: false });

  const sessions = (completedSessions ?? []) as Array<{
    started_at: string;
    ended_at: string;
  }>;

  let thisWeekMinutes = 0;
  let thisMonthMinutes = 0;
  let thisWeekCount = 0;
  let thisMonthCount = 0;

  for (const s of sessions) {
    const start = new Date(s.started_at);
    const end = new Date(s.ended_at);
    const minutes = (end.getTime() - start.getTime()) / (1000 * 60);

    thisMonthMinutes += minutes;
    thisMonthCount++;

    if (start >= weekStart) {
      thisWeekMinutes += minutes;
      thisWeekCount++;
    }
  }

  // 3. Top 3 weaknesses
  const { data: skillRatings } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_calibrated', true)
    .order('elo_rating', { ascending: true });

  const ratings = (skillRatings ?? []) as SkillRating[];
  const topWeaknesses = ratings.slice(0, 3).map((r) => {
    const skill = skillMap.get(r.sub_skill_id);
    const accuracy =
      r.questions_attempted > 0
        ? r.questions_correct / r.questions_attempted
        : 0;
    return {
      skillId: r.sub_skill_id,
      skillName: skill?.name ?? r.sub_skill_id,
      domain: skill?.domain ?? 'Unknown',
      elo: r.elo_rating,
      accuracy: Math.round(accuracy * 100),
      mastery: getMasteryLevel(r.elo_rating),
    };
  });

  // 4. Alerts
  const { data: alertData } = await supabase
    .from('parent_alerts')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  const alerts = (alertData ?? []) as ParentAlert[];

  // 5. Error rate by topic — top 5 most-practiced skills over last 8 weeks
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 56);

  // Find top 5 most-practiced skills
  const topSkillIds = ratings
    .sort((a, b) => b.questions_attempted - a.questions_attempted)
    .slice(0, 5)
    .map((r) => r.sub_skill_id);

  let errorRateByTopic: ParentDashboardData['errorRateByTopic'] = [];

  if (topSkillIds.length > 0) {
    // Load question attempts with their question's sub_skill_id
    const { data: attempts } = await supabase
      .from('question_attempts')
      .select('is_correct, attempted_at, question_id')
      .eq('student_id', studentId)
      .gte('attempted_at', eightWeeksAgo.toISOString());

    // Load the questions to get their sub_skill_id
    const attemptsList = (attempts ?? []) as Array<{
      is_correct: boolean;
      attempted_at: string;
      question_id: string;
    }>;

    const questionIds = [
      ...new Set(attemptsList.map((a) => a.question_id)),
    ];

    let questionSkillMap = new Map<string, string>();
    if (questionIds.length > 0) {
      const { data: questions } = await supabase
        .from('questions')
        .select('question_id, sub_skill_id')
        .in('question_id', questionIds);

      for (const q of (questions ?? []) as Array<{
        question_id: string;
        sub_skill_id: string;
      }>) {
        questionSkillMap.set(q.question_id, q.sub_skill_id);
      }
    }

    // Group by skill and week
    const skillWeekData = new Map<
      string,
      Map<string, { correct: number; total: number }>
    >();

    for (const a of attemptsList) {
      const skillId = questionSkillMap.get(a.question_id);
      if (!skillId || !topSkillIds.includes(skillId)) continue;

      const weekLabel = getWeekLabel(new Date(a.attempted_at));

      if (!skillWeekData.has(skillId)) {
        skillWeekData.set(skillId, new Map());
      }
      const weekMap = skillWeekData.get(skillId)!;
      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, { correct: 0, total: 0 });
      }
      const entry = weekMap.get(weekLabel)!;
      entry.total++;
      if (a.is_correct) entry.correct++;
    }

    // Generate week labels for last 8 weeks
    const weekLabels: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekLabels.push(getWeekLabel(d));
    }
    // Deduplicate week labels while preserving order
    const uniqueWeekLabels = [...new Set(weekLabels)];

    errorRateByTopic = topSkillIds.map((skillId) => {
      const skill = skillMap.get(skillId);
      const weekMap = skillWeekData.get(skillId) ?? new Map();

      const weeks = uniqueWeekLabels.map((weekLabel) => {
        const entry = weekMap.get(weekLabel);
        if (!entry || entry.total === 0) {
          return { weekLabel, errorRate: 0, attempts: 0 };
        }
        return {
          weekLabel,
          errorRate: Math.round(
            ((entry.total - entry.correct) / entry.total) * 100
          ),
          attempts: entry.total,
        };
      });

      return {
        skillId,
        skillName: skill?.name ?? skillId,
        weeks,
      };
    });
  }

  // 6. Recent sessions
  const { data: recentData } = await supabase
    .from('sessions')
    .select('*')
    .eq('student_id', studentId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(10);

  const recentSessions = (recentData ?? []) as Session[];

  // 7. All skill ratings (including uncalibrated) for the full table
  const { data: allRatingsData } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', studentId)
    .order('sub_skill_id', { ascending: true });

  const allSkillRatings = (allRatingsData ?? []) as SkillRating[];

  return {
    scorePrediction,
    scoreTrend,
    studyTime: {
      thisWeekMinutes: Math.round(thisWeekMinutes),
      thisMonthMinutes: Math.round(thisMonthMinutes),
    },
    sessionFrequency: { thisWeek: thisWeekCount, thisMonth: thisMonthCount },
    topWeaknesses,
    alerts,
    errorRateByTopic,
    recentSessions,
    allSkillRatings,
  };
}

// ============================================
// Alert generation
// ============================================

export async function generateParentAlerts(
  studentId: string
): Promise<void> {
  const supabase = createServerClient();

  // --- Study gap alert ---
  const threeDaysAgo = new Date();
  threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
  const threeDaysAgoDate = threeDaysAgo.toISOString().split('T')[0];

  const { data: recentActivity } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('student_id', studentId)
    .gte('activity_date', threeDaysAgoDate)
    .eq('streak_qualifying', true);

  if (!recentActivity || recentActivity.length === 0) {
    // Check for existing study_gap alert in last 3 days
    const { data: existingGapAlerts } = await supabase
      .from('parent_alerts')
      .select('id')
      .eq('student_id', studentId)
      .eq('alert_type', 'study_gap')
      .gte('created_at', threeDaysAgo.toISOString())
      .limit(1);

    if (!existingGapAlerts || existingGapAlerts.length === 0) {
      await supabase.from('parent_alerts').insert({
        student_id: studentId,
        alert_type: 'study_gap',
        title: 'Study gap detected',
        description:
          'Your student has not completed any qualifying study sessions in the last 3 days.',
        severity: 'warning',
        is_read: false,
        metadata: {},
      });
    }
  }

  // --- Skill regression alert ---
  const oneWeekAgo = new Date();
  oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - 7);

  const { data: calibratedSkills } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_calibrated', true);

  const skills = (calibratedSkills ?? []) as SkillRating[];

  for (const skill of skills) {
    // Get attempts from the last week for this skill's questions
    const { data: recentAttempts } = await supabase
      .from('question_attempts')
      .select('is_correct, attempted_at')
      .eq('student_id', studentId)
      .gte('attempted_at', oneWeekAgo.toISOString());

    // We need to check if elo dropped 75+ points
    // Approximate: compare current elo to what it would have been a week ago
    // Simple approach: check if current elo is 75+ below the starting elo (1200)
    // or if we have historical data
    // Better approach: look at the rating's recent trend via attempts

    // For a practical implementation, we check if current elo is significantly
    // lower than it was. We can use the skill's questions_attempted to see
    // if there have been recent drops. Since we don't have historical elo snapshots,
    // we'll check if recent accuracy for this skill is very low (< 25%) with enough attempts.

    // Actually, let's use a simpler heuristic: if current elo < 1200 and
    // recent accuracy for the skill is below 30%, flag it.
    // But the spec says "elo dropped 75+ points in the last week."
    // Without historical snapshots, we'll check if the skill has had
    // enough wrong answers recently to cause a 75+ point drop.

    // With K=20 and minimum adjustment of 15, each wrong answer drops ~15-20 points.
    // So 4+ wrong answers in a row would be ~75 points.
    // Let's check recent attempts for this specific skill.

    const { data: skillAttempts } = await supabase
      .from('question_attempts')
      .select('is_correct, attempted_at, question_id')
      .eq('student_id', studentId)
      .gte('attempted_at', oneWeekAgo.toISOString())
      .order('attempted_at', { ascending: false });

    if (!skillAttempts || skillAttempts.length === 0) continue;

    // Get question IDs for this skill
    const { data: skillQuestions } = await supabase
      .from('questions')
      .select('question_id')
      .eq('sub_skill_id', skill.sub_skill_id);

    const skillQuestionIds = new Set(
      (skillQuestions ?? []).map((q: { question_id: string }) => q.question_id)
    );

    const relevantAttempts = (
      skillAttempts as Array<{
        is_correct: boolean;
        attempted_at: string;
        question_id: string;
      }>
    ).filter((a) => skillQuestionIds.has(a.question_id));

    if (relevantAttempts.length < 4) continue;

    // Estimate elo drop: count wrong answers, each ~15-20 points
    const wrongCount = relevantAttempts.filter((a) => !a.is_correct).length;
    const rightCount = relevantAttempts.filter((a) => a.is_correct).length;
    const estimatedDrop = wrongCount * 17 - rightCount * 17; // net drop estimate

    if (estimatedDrop >= 75) {
      // Check for existing regression alert for this skill in the last week
      const { data: existingRegAlerts } = await supabase
        .from('parent_alerts')
        .select('id')
        .eq('student_id', studentId)
        .eq('alert_type', 'skill_regression')
        .gte('created_at', oneWeekAgo.toISOString());

      const existingForSkill = (existingRegAlerts ?? []).length > 0;
      // More precise dedup: check metadata for this skill
      // For simplicity, check if any regression alert exists for this skill recently
      const { data: exactMatch } = await supabase
        .from('parent_alerts')
        .select('id')
        .eq('student_id', studentId)
        .eq('alert_type', 'skill_regression')
        .gte('created_at', oneWeekAgo.toISOString())
        .contains('metadata', { skillId: skill.sub_skill_id })
        .limit(1);

      if (!exactMatch || exactMatch.length === 0) {
        const skillInfo = skillMap.get(skill.sub_skill_id);
        await supabase.from('parent_alerts').insert({
          student_id: studentId,
          alert_type: 'skill_regression',
          title: `Skill regression: ${skillInfo?.name ?? skill.sub_skill_id}`,
          description: `Performance in ${skillInfo?.name ?? skill.sub_skill_id} has dropped significantly this week (estimated ${estimatedDrop}+ Elo points lost).`,
          severity: 'critical',
          is_read: false,
          metadata: { skillId: skill.sub_skill_id, estimatedDrop },
        });
      }
    }
  }
}
