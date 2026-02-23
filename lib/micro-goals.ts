import { createServerClient } from './supabase';
import { computeCurrentStreak } from './streak-calculator';
import { getMasteryLevel } from './elo';
import { SKILL_TAXONOMY } from './types';
import type { MicroGoal, SkillRating } from './types';

export interface MicroGoalData {
  id: string;
  goalType: MicroGoal['goal_type'];
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
}

// ============================================
// Week start helper (Monday)
// ============================================

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// ============================================
// Goal generation
// ============================================

interface GoalCandidate {
  priority: number;
  goalType: MicroGoal['goal_type'];
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
}

const allSkills = [...SKILL_TAXONOMY.reading_writing, ...SKILL_TAXONOMY.math];
const skillNameMap = new Map<string, string>();
for (const s of allSkills) skillNameMap.set(s.id, s.name);

async function generateGoalCandidates(studentId: string): Promise<GoalCandidate[]> {
  const supabase = createServerClient();
  const candidates: GoalCandidate[] = [];
  const weekStart = getWeekStart();
  const weekStartDate = new Date(weekStart);

  // Load skill ratings
  const { data: ratingsData } = await supabase
    .from('skill_ratings')
    .select('*')
    .eq('student_id', studentId);
  const ratings = (ratingsData || []) as SkillRating[];

  // 1. Reduce careless errors
  const twoWeeksAgo = new Date(weekStartDate);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: recentWrongAttempts } = await supabase
    .from('question_attempts')
    .select('error_type')
    .eq('student_id', studentId)
    .eq('is_correct', false)
    .gte('attempted_at', twoWeeksAgo.toISOString());

  const wrongAttempts = recentWrongAttempts || [];
  const carelessCount = wrongAttempts.filter(
    (a: { error_type: string | null }) => a.error_type === 'careless_rush'
  ).length;

  if (wrongAttempts.length > 0 && carelessCount / wrongAttempts.length > 0.15) {
    const target = Math.max(1, Math.ceil(carelessCount * 0.8));

    // Count this week's careless errors
    const { count: thisWeekCareless } = await supabase
      .from('question_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('is_correct', false)
      .eq('error_type', 'careless_rush')
      .gte('attempted_at', weekStartDate.toISOString());

    candidates.push({
      priority: 1,
      goalType: 'reduce_errors',
      title: 'Reduce careless errors by 20%',
      description: `You had ${carelessCount} careless errors recently. Target: fewer than ${target} this week.`,
      targetValue: target,
      currentValue: thisWeekCareless ?? 0,
    });
  }

  // 2. Accuracy target on weakest skill
  const calibrated = ratings.filter((r) => r.is_calibrated);
  if (calibrated.length > 0) {
    const weakest = calibrated.reduce((a, b) =>
      a.elo_rating < b.elo_rating ? a : b
    );
    const weakestAccuracy =
      weakest.questions_attempted > 0
        ? Math.round((weakest.questions_correct / weakest.questions_attempted) * 100)
        : 0;

    if (weakestAccuracy < 70) {
      const skillName = skillNameMap.get(weakest.sub_skill_id) ?? weakest.sub_skill_id;

      // Get this week's accuracy for that skill
      const { data: skillQuestions } = await supabase
        .from('questions')
        .select('question_id')
        .eq('sub_skill_id', weakest.sub_skill_id);
      const qIds = (skillQuestions || []).map((q: { question_id: string }) => q.question_id);

      let weeklyAccuracy = 0;
      if (qIds.length > 0) {
        const { count: weekTotal } = await supabase
          .from('question_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .in('question_id', qIds)
          .gte('attempted_at', weekStartDate.toISOString());

        const { count: weekCorrect } = await supabase
          .from('question_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('is_correct', true)
          .in('question_id', qIds)
          .gte('attempted_at', weekStartDate.toISOString());

        weeklyAccuracy =
          (weekTotal ?? 0) > 0
            ? Math.round(((weekCorrect ?? 0) / (weekTotal ?? 1)) * 100)
            : 0;
      }

      candidates.push({
        priority: 2,
        goalType: 'accuracy_target',
        title: `Hit 80% on ${skillName}`,
        description: `Your accuracy on ${skillName} is ${weakestAccuracy}%. Practice to reach 80%.`,
        targetValue: 80,
        currentValue: weeklyAccuracy,
      });
    }
  }

  // 3. Master new skills
  const masteredCount = ratings.filter((r) => r.elo_rating >= 1500).length;
  const nearMastery = ratings.filter(
    (r) => r.elo_rating >= 1300 && r.elo_rating < 1500
  );
  if (nearMastery.length > 0) {
    candidates.push({
      priority: 3,
      goalType: 'master_skills',
      title: 'Master 2 new sub-skills',
      description: `You have ${nearMastery.length} skills near mastery. Push 2 to Mastered level this week.`,
      targetValue: masteredCount + 2,
      currentValue: masteredCount,
    });
  }

  // 4. Complete timed drills
  const { count: drillsThisWeek } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('session_type', 'timed_section')
    .not('ended_at', 'is', null)
    .gte('started_at', weekStartDate.toISOString());

  if ((drillsThisWeek ?? 0) < 3) {
    candidates.push({
      priority: 4,
      goalType: 'complete_drills',
      title: 'Complete 3 timed drills',
      description: 'Timed practice builds test-day stamina and pacing skills.',
      targetValue: 3,
      currentValue: drillsThisWeek ?? 0,
    });
  }

  // 5. Build study streak
  const streakData = await computeCurrentStreak(studentId);
  if (streakData.currentStreak < 7) {
    candidates.push({
      priority: 5,
      goalType: 'study_streak',
      title: 'Build a 7-day study streak',
      description: 'Study every day this week to build consistency.',
      targetValue: 7,
      currentValue: streakData.currentStreak,
    });
  }

  // 6. Clear review queue
  const today = new Date().toISOString().split('T')[0];
  const { count: pendingReviews } = await supabase
    .from('review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .lte('next_review_date', today);

  if ((pendingReviews ?? 0) >= 5) {
    candidates.push({
      priority: 6,
      goalType: 'review_queue',
      title: 'Clear your review queue',
      description: `You have ${pendingReviews} questions due for review. Clear them to reinforce learning.`,
      targetValue: 0,
      currentValue: pendingReviews ?? 0,
    });
  }

  return candidates.sort((a, b) => a.priority - b.priority);
}

// ============================================
// Public API
// ============================================

export async function getOrGenerateWeeklyGoals(
  studentId: string
): Promise<MicroGoalData[]> {
  const supabase = createServerClient();
  const weekStart = getWeekStart();

  // Check for existing goals
  const { data: existing } = await supabase
    .from('micro_goals')
    .select('*')
    .eq('student_id', studentId)
    .eq('week_start', weekStart);

  if (existing && existing.length > 0) {
    return (existing as MicroGoal[]).map(toMicroGoalData);
  }

  // Generate new goals
  const candidates = await generateGoalCandidates(studentId);
  const selected = candidates.slice(0, 4); // Top 3-4

  if (selected.length === 0) {
    return [];
  }

  const rows = selected.map((c) => ({
    student_id: studentId,
    week_start: weekStart,
    goal_type: c.goalType,
    title: c.title,
    description: c.description,
    target_value: c.targetValue,
    current_value: c.currentValue,
    is_completed: false,
  }));

  const { data: inserted } = await supabase
    .from('micro_goals')
    .insert(rows)
    .select();

  return ((inserted || []) as MicroGoal[]).map(toMicroGoalData);
}

export async function updateGoalProgress(studentId: string): Promise<void> {
  const supabase = createServerClient();
  const weekStart = getWeekStart();
  const weekStartDate = new Date(weekStart);

  const { data: goals } = await supabase
    .from('micro_goals')
    .select('*')
    .eq('student_id', studentId)
    .eq('week_start', weekStart)
    .eq('is_completed', false);

  if (!goals || goals.length === 0) return;

  for (const goal of goals as MicroGoal[]) {
    let newValue = goal.current_value;

    switch (goal.goal_type) {
      case 'master_skills': {
        const { data: ratings } = await supabase
          .from('skill_ratings')
          .select('elo_rating')
          .eq('student_id', studentId);
        newValue = (ratings || []).filter(
          (r: { elo_rating: number }) => r.elo_rating >= 1500
        ).length;
        break;
      }
      case 'complete_drills': {
        const { count } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('session_type', 'timed_section')
          .not('ended_at', 'is', null)
          .gte('started_at', weekStartDate.toISOString());
        newValue = count ?? 0;
        break;
      }
      case 'reduce_errors': {
        const { count } = await supabase
          .from('question_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('is_correct', false)
          .eq('error_type', 'careless_rush')
          .gte('attempted_at', weekStartDate.toISOString());
        newValue = count ?? 0;
        break;
      }
      case 'accuracy_target': {
        // Parse skill name from title "Hit 80% on [skill]"
        // Re-check accuracy for the weakest skill
        const { data: ratings } = await supabase
          .from('skill_ratings')
          .select('*')
          .eq('student_id', studentId);
        const calibrated = ((ratings || []) as SkillRating[]).filter(
          (r) => r.is_calibrated
        );
        if (calibrated.length > 0) {
          const weakest = calibrated.reduce((a, b) =>
            a.elo_rating < b.elo_rating ? a : b
          );
          newValue =
            weakest.questions_attempted > 0
              ? Math.round(
                  (weakest.questions_correct / weakest.questions_attempted) * 100
                )
              : 0;
        }
        break;
      }
      case 'study_streak': {
        const streakData = await computeCurrentStreak(studentId);
        newValue = streakData.currentStreak;
        break;
      }
      case 'review_queue': {
        const today = new Date().toISOString().split('T')[0];
        const { count } = await supabase
          .from('review_queue')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .lte('next_review_date', today);
        newValue = count ?? 0;
        break;
      }
    }

    // Determine completion
    let isCompleted = false;
    if (goal.goal_type === 'reduce_errors' || goal.goal_type === 'review_queue') {
      // Lower is better
      isCompleted = newValue <= goal.target_value;
    } else {
      // Higher is better
      isCompleted = newValue >= goal.target_value;
    }

    await supabase
      .from('micro_goals')
      .update({
        current_value: newValue,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', goal.id);
  }
}

// ============================================
// Helper
// ============================================

function toMicroGoalData(goal: MicroGoal): MicroGoalData {
  return {
    id: goal.id,
    goalType: goal.goal_type,
    title: goal.title,
    description: goal.description,
    targetValue: goal.target_value,
    currentValue: goal.current_value,
    isCompleted: goal.is_completed,
  };
}
