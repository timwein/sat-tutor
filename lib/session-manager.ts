import type { SessionConfig, SessionPhase } from './types';

// ============================================
// Session configurations
// ============================================

export const SESSION_CONFIGS: Record<string, SessionConfig> = {
  quick_drill: { type: 'quick_drill', durationMinutes: 10, maxQuestions: 10 },
  study_session: { type: 'study_session', durationMinutes: 35, maxQuestions: 50 },
  timed_section: { type: 'timed_section', durationMinutes: 35, maxQuestions: 27 },
  full_practice_test: { type: 'full_practice_test', durationMinutes: 134, maxQuestions: 98 },
};

// ============================================
// Session phase calculation
// ============================================

// Phase boundaries as percentages of total session time
// Derived from spec Section 8.3 (35-min session: 5/10/10/7/3 minutes)
const PHASE_BOUNDARIES: Array<{ threshold: number; phase: SessionPhase }> = [
  { threshold: 0.14, phase: 'warmup' },   // 0-14%
  { threshold: 0.43, phase: 'ramp' },      // 14-43%
  { threshold: 0.71, phase: 'peak' },      // 43-71%
  { threshold: 0.91, phase: 'easeoff' },   // 71-91%
  { threshold: 1.0, phase: 'endwin' },     // 91-100%
];

export function getSessionPhase(elapsedMinutes: number, totalMinutes: number): SessionPhase {
  if (totalMinutes <= 0) return 'warmup';

  const progress = Math.min(elapsedMinutes / totalMinutes, 1);

  for (const boundary of PHASE_BOUNDARIES) {
    if (progress <= boundary.threshold) {
      return boundary.phase;
    }
  }

  return 'endwin';
}

// ============================================
// Session completion check
// ============================================

export function isSessionComplete(
  questionsAnswered: number,
  elapsedMinutes: number,
  config: SessionConfig
): boolean {
  return questionsAnswered >= config.maxQuestions || elapsedMinutes >= config.durationMinutes;
}

// ============================================
// Phase display labels
// ============================================

export const PHASE_LABELS: Record<SessionPhase, string> = {
  warmup: 'Warming up',
  ramp: 'Building momentum',
  peak: 'Peak focus',
  easeoff: 'Consolidating',
  endwin: 'Finishing strong',
};
