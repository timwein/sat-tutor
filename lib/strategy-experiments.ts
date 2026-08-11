// Reading-protocol A/B experiment: three protocols rotate across matched
// drills of passage-comprehension questions; the data picks the winner.

export const EXPERIMENT_SKILL_POOL = ['RW-01', 'RW-04', 'RW-06'];
export const DRILLS_PER_ARM = 4;

export interface ExperimentArm {
  tag: string;
  name: string;
  /** One-line instruction shown before every drill under this protocol */
  instruction: string;
  /** How to execute it, shown on the pre-drill brief */
  how: string[];
}

export const EXPERIMENT_ARMS: ExperimentArm[] = [
  {
    tag: 'passage_first',
    name: 'Passage first',
    instruction: 'Read the full passage carefully before looking at the question.',
    how: [
      'Read the whole passage once, actively - track the main claim.',
      'Then read the question and choices.',
      'Target pace: 100-110 seconds per question.',
    ],
  },
  {
    tag: 'question_first',
    name: 'Question first',
    instruction: 'Read the question and choices first, then hunt the passage for exactly what you need.',
    how: [
      'Read the question stem and all four choices before the passage.',
      'Scan the passage only for the lines that decide between choices.',
      'Answer as soon as the text settles it - no full read required.',
    ],
  },
  {
    tag: 'skim_verify',
    name: 'Skim, then verify',
    instruction: 'Skim for structure in ~15 seconds, answer from your read, then verify against the text.',
    how: [
      'Spend ~15 seconds skimming: first sentence, last sentence, shape of the middle.',
      'Read the question and pick the choice your skim supports.',
      'Before locking in, find the specific line that confirms it.',
    ],
  },
];

export interface ArmTally {
  drills: number;
  questions: number;
  correct: number;
  time_seconds: number;
}

export type ArmsState = Record<string, ArmTally>;

export function emptyArms(): ArmsState {
  return Object.fromEntries(
    EXPERIMENT_ARMS.map((a) => [a.tag, { drills: 0, questions: 0, correct: 0, time_seconds: 0 }])
  );
}

export function getArm(tag: string): ExperimentArm | undefined {
  return EXPERIMENT_ARMS.find((a) => a.tag === tag);
}

/** Next arm to assign: fewest drills, ties broken by definition order. */
export function nextArm(arms: ArmsState): ExperimentArm {
  let best = EXPERIMENT_ARMS[0];
  let bestCount = arms[best.tag]?.drills ?? 0;
  for (const arm of EXPERIMENT_ARMS.slice(1)) {
    const count = arms[arm.tag]?.drills ?? 0;
    if (count < bestCount) {
      best = arm;
      bestCount = count;
    }
  }
  return best;
}

export function isComplete(arms: ArmsState): boolean {
  return EXPERIMENT_ARMS.every((a) => (arms[a.tag]?.drills ?? 0) >= DRILLS_PER_ARM);
}

export interface ArmSummary {
  tag: string;
  name: string;
  drills: number;
  questions: number;
  accuracy: number | null;
  median_seconds_per_question: number | null;
}

export function summarizeArms(arms: ArmsState): ArmSummary[] {
  return EXPERIMENT_ARMS.map((a) => {
    const t = arms[a.tag] ?? { drills: 0, questions: 0, correct: 0, time_seconds: 0 };
    return {
      tag: a.tag,
      name: a.name,
      drills: t.drills,
      questions: t.questions,
      accuracy: t.questions > 0 ? t.correct / t.questions : null,
      median_seconds_per_question:
        t.questions > 0 ? Math.round(t.time_seconds / t.questions) : null,
    };
  });
}

/** Deterministic winner: accuracy first, faster pace breaks ties within 3 points. */
export function pickWinner(summaries: ArmSummary[]): ArmSummary | null {
  const scored = summaries.filter((s) => s.accuracy !== null);
  if (scored.length === 0) return null;
  const sorted = [...scored].sort((a, b) => {
    const accDiff = (b.accuracy ?? 0) - (a.accuracy ?? 0);
    if (Math.abs(accDiff) > 0.03) return accDiff > 0 ? 1 : -1;
    return (a.median_seconds_per_question ?? 999) - (b.median_seconds_per_question ?? 999);
  });
  return sorted[0];
}
