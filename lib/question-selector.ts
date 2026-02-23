import type {
  Question,
  SkillRating,
  ReviewQueueItem,
  SessionPhase,
  SelectionCategory,
  QuestionSelectionResult,
} from './types';
import { getTargetDifficulty } from './elo';

export interface QuestionSelectionParams {
  skillRatings: SkillRating[];
  reviewQueue: ReviewQueueItem[];
  availableQuestions: Question[];
  sessionPhase: SessionPhase;
  isFrustrated: boolean;
  /** For Quick Drill: lock to a single sub-skill */
  subSkillFocus?: string | null;
  /** For filtering by section */
  sectionFocus?: 'math' | 'reading_writing' | null;
}

export function selectNextQuestion(
  params: QuestionSelectionParams
): QuestionSelectionResult | null {
  const {
    skillRatings,
    reviewQueue,
    availableQuestions,
    sessionPhase,
    isFrustrated,
    subSkillFocus,
    sectionFocus,
  } = params;

  // Filter questions by section if specified
  let candidates = availableQuestions;
  if (sectionFocus) {
    candidates = candidates.filter((q) => q.section === sectionFocus);
  }

  if (candidates.length === 0) return null;

  // Quick Drill: single sub-skill focus
  if (subSkillFocus) {
    return selectForSubSkill(subSkillFocus, candidates, skillRatings, sessionPhase, isFrustrated, 'lowest_rated');
  }

  // Build candidate pools
  const lowestRated = getLowestRatedSubSkills(skillRatings, candidates, 3);
  const spacedRepDue = getSpacedRepSubSkills(reviewQueue, candidates, 2);

  // Weighted random selection
  const roll = Math.random();
  let category: SelectionCategory;
  let targetSubSkills: string[];

  if (roll < 0.5 && lowestRated.length > 0) {
    category = 'lowest_rated';
    targetSubSkills = lowestRated;
  } else if (roll < 0.8 && spacedRepDue.length > 0) {
    category = 'spaced_repetition';
    targetSubSkills = spacedRepDue;
  } else {
    category = 'random';
    // Pick from any sub-skill that has available questions
    const allSubSkills = [...new Set(candidates.map((q) => q.sub_skill_id))];
    targetSubSkills = allSubSkills;
  }

  // Fallback: if chosen category has no sub-skills, try others
  if (targetSubSkills.length === 0) {
    if (lowestRated.length > 0) {
      category = 'lowest_rated';
      targetSubSkills = lowestRated;
    } else {
      category = 'random';
      targetSubSkills = [...new Set(candidates.map((q) => q.sub_skill_id))];
    }
  }

  if (targetSubSkills.length === 0) return null;

  // Pick a random sub-skill from the target list
  const chosenSubSkill = targetSubSkills[Math.floor(Math.random() * targetSubSkills.length)];

  return selectForSubSkill(chosenSubSkill, candidates, skillRatings, sessionPhase, isFrustrated, category);
}

function selectForSubSkill(
  subSkillId: string,
  candidates: Question[],
  skillRatings: SkillRating[],
  sessionPhase: SessionPhase,
  isFrustrated: boolean,
  category: SelectionCategory
): QuestionSelectionResult | null {
  const subSkillQuestions = candidates.filter((q) => q.sub_skill_id === subSkillId);

  // If no questions for this sub-skill, try any available question
  if (subSkillQuestions.length === 0) {
    if (candidates.length === 0) return null;
    // Fall back to random question from remaining pool
    const q = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      question: q,
      category: 'random',
      targetSubSkill: q.sub_skill_id,
      targetDifficulty: q.difficulty,
      reason: `Fallback: no questions available for ${subSkillId}`,
    };
  }

  // Get current Elo for this sub-skill
  const rating = skillRatings.find((r) => r.sub_skill_id === subSkillId);
  const currentElo = rating?.elo_rating ?? 1000;

  // Calculate target difficulty
  const targetDiff = getTargetDifficulty({
    currentElo,
    isFrustrated,
    sessionPhase,
  });

  // Score questions by closeness to target difficulty
  const scored = subSkillQuestions
    .map((q) => ({
      question: q,
      distance: Math.abs(q.difficulty - targetDiff),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Pick from the closest matches (within distance 1), random among ties
  const minDistance = scored[0].distance;
  const closestMatches = scored.filter((s) => s.distance <= minDistance + 1);
  const chosen = closestMatches[Math.floor(Math.random() * closestMatches.length)];

  return {
    question: chosen.question,
    category,
    targetSubSkill: subSkillId,
    targetDifficulty: targetDiff,
    reason: `Selected ${category} sub-skill ${subSkillId} (Elo: ${currentElo}, target difficulty: ${targetDiff}, actual: ${chosen.question.difficulty})`,
  };
}

function getLowestRatedSubSkills(
  skillRatings: SkillRating[],
  availableQuestions: Question[],
  count: number
): string[] {
  // Get sub-skills that have available questions
  const subSkillsWithQuestions = new Set(availableQuestions.map((q) => q.sub_skill_id));

  // Sort ratings ascending by Elo, filter to those with questions available
  const sorted = skillRatings
    .filter((r) => subSkillsWithQuestions.has(r.sub_skill_id))
    .sort((a, b) => a.elo_rating - b.elo_rating);

  const result = sorted.slice(0, count).map((r) => r.sub_skill_id);

  // If we have fewer than `count` rated sub-skills, add unrated ones that have questions
  if (result.length < count) {
    const ratedSubSkills = new Set(skillRatings.map((r) => r.sub_skill_id));
    const unrated = [...subSkillsWithQuestions].filter((s) => !ratedSubSkills.has(s));
    result.push(...unrated.slice(0, count - result.length));
  }

  return result;
}

function getSpacedRepSubSkills(
  reviewQueue: ReviewQueueItem[],
  availableQuestions: Question[],
  count: number
): string[] {
  if (reviewQueue.length === 0) return [];

  const subSkillsWithQuestions = new Set(availableQuestions.map((q) => q.sub_skill_id));

  // Find unique sub-skills from review items that have available questions
  // The review queue items link to question_ids, so we need to find which sub-skills they belong to
  const reviewQuestionIds = new Set(reviewQueue.map((r) => r.question_id));
  const reviewSubSkills = [
    ...new Set(
      availableQuestions
        .filter((q) => reviewQuestionIds.has(q.question_id) && subSkillsWithQuestions.has(q.sub_skill_id))
        .map((q) => q.sub_skill_id)
    ),
  ];

  return reviewSubSkills.slice(0, count);
}
