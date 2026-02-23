import type { MasteryLevel, SessionPhase } from './types';

// ============================================
// Difficulty ↔ Elo mapping
// ============================================

export const DIFFICULTY_TO_ELO: Record<number, number> = {
  1: 800,
  2: 1000,
  3: 1200,
  4: 1400,
  5: 1600,
};

export function eloToDifficulty(elo: number): number {
  // Reverse mapping: clamp to 1-5
  const raw = Math.round((elo - 600) / 200);
  return Math.max(1, Math.min(5, raw));
}

// ============================================
// Mastery levels
// ============================================

export function getMasteryLevel(elo: number): MasteryLevel {
  if (elo >= 1500) return 'Mastered';
  if (elo >= 1300) return 'Proficient';
  if (elo >= 1100) return 'Progressing';
  return 'Developing';
}

// ============================================
// Elo calculation
// ============================================

const ELO_FLOOR = 500;
const ELO_CEILING = 2000;

function getKFactor(questionsAttempted: number): number {
  if (questionsAttempted < 5) return 40;   // uncalibrated — big swings
  if (questionsAttempted < 16) return 30;  // calibrated
  return 20;                                // well-calibrated
}

export function calculateExpectedScore(playerElo: number, questionElo: number): number {
  return 1 / (1 + Math.pow(10, (questionElo - playerElo) / 400));
}

export function calculateEloAdjustment(params: {
  currentElo: number;
  questionDifficulty: number;
  isCorrect: boolean;
  questionsAttempted: number;
}): { newElo: number; delta: number; kFactor: number } {
  const { currentElo, questionDifficulty, isCorrect, questionsAttempted } = params;

  const questionElo = DIFFICULTY_TO_ELO[questionDifficulty] ?? 1200;
  const expected = calculateExpectedScore(currentElo, questionElo);
  const actual = isCorrect ? 1 : 0;
  const kFactor = getKFactor(questionsAttempted);

  let delta = Math.round(kFactor * (actual - expected));

  // Enforce minimum adjustment of 15 points (spec requirement)
  if (delta > 0 && delta < 15) delta = 15;
  if (delta < 0 && delta > -15) delta = -15;

  // Clamp to floor/ceiling
  const newElo = Math.max(ELO_FLOOR, Math.min(ELO_CEILING, currentElo + delta));
  const actualDelta = newElo - currentElo;

  return { newElo, delta: actualDelta, kFactor };
}

// ============================================
// Target difficulty for question selection
// ============================================

const PHASE_ELO_OFFSET: Record<SessionPhase, number> = {
  warmup: -50,
  ramp: 0,
  peak: 100,
  easeoff: -50,
  endwin: -200,
};

export function getTargetDifficulty(params: {
  currentElo: number;
  isFrustrated: boolean;
  sessionPhase: SessionPhase;
}): number {
  const { currentElo, isFrustrated, sessionPhase } = params;

  let targetElo = currentElo + PHASE_ELO_OFFSET[sessionPhase];

  if (isFrustrated) {
    targetElo -= 100;
  }

  return eloToDifficulty(targetElo);
}
