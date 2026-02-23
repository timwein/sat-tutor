import type { SkillRating } from './types';

export interface SkillEdge {
  from: string;  // prerequisite skill ID
  to: string;    // dependent skill ID
}

export const SKILL_PREREQUISITES: SkillEdge[] = [
  // Math: Algebra chain
  { from: 'M-01', to: 'M-02' },  // Linear Equations 1var -> 2var
  { from: 'M-02', to: 'M-04' },  // Linear Equations 2var -> Systems
  { from: 'M-02', to: 'M-03' },  // Linear Equations 2var -> Linear Functions
  { from: 'M-01', to: 'M-05' },  // Linear Equations 1var -> Linear Inequalities
  // Math: Advanced Math
  { from: 'M-03', to: 'M-06' },  // Linear Functions -> Nonlinear
  { from: 'M-07', to: 'M-08' },  // Equivalent Expressions -> Quadratics
  { from: 'M-06', to: 'M-09' },  // Nonlinear -> Exponential
  // Math: Problem Solving & Data
  { from: 'M-10', to: 'M-11' },  // Ratios -> Percentages
  { from: 'M-12', to: 'M-13' },  // One-Variable Data -> Two-Variable Data
  { from: 'M-13', to: 'M-15' },  // Scatterplots -> Inference
  { from: 'M-12', to: 'M-14' },  // One-Variable Data -> Probability
  // Math: Geometry & Trig
  { from: 'M-16', to: 'M-19' },  // Area/Volume -> Circles
  { from: 'M-17', to: 'M-18' },  // Lines/Angles/Triangles -> Right Triangles
  // RW: Information and Ideas
  { from: 'RW-01', to: 'RW-04' },  // Central Ideas -> Inferences
  { from: 'RW-02', to: 'RW-03' },  // Textual Evidence -> Quantitative Evidence
  // RW: Craft and Structure
  { from: 'RW-05', to: 'RW-06' },  // Words in Context -> Text Structure
  { from: 'RW-06', to: 'RW-07' },  // Text Structure -> Cross-Text Connections
  { from: 'RW-06', to: 'RW-08' },  // Text Structure -> Rhetorical Synthesis
  // RW: Expression + Conventions
  { from: 'RW-10', to: 'RW-11' },  // Boundaries -> Form, Structure, Sense
];

export type SkillTreeStatus = 'locked' | 'available' | 'in_progress' | 'mastered';

export function getPrerequisites(skillId: string): string[] {
  return SKILL_PREREQUISITES.filter(e => e.to === skillId).map(e => e.from);
}

export function getSkillTreeStatus(
  skillId: string,
  ratingMap: Map<string, SkillRating>
): SkillTreeStatus {
  const rating = ratingMap.get(skillId);
  const prereqs = getPrerequisites(skillId);
  const prereqsMet = prereqs.every(pid => {
    const prereqRating = ratingMap.get(pid);
    return prereqRating && prereqRating.questions_attempted > 0;
  });

  if (!rating || rating.questions_attempted === 0) {
    if (prereqs.length === 0) return 'available';
    return prereqsMet ? 'available' : 'locked';
  }

  if (rating.elo_rating >= 1500) return 'mastered';
  return 'in_progress';
}
