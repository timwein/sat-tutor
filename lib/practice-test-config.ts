import type { ModuleDefinition } from './types';
import { createServerClient } from './supabase';

// ============================================
// SAT Module Definitions (official structure)
// ============================================

export const SAT_MODULES: ModuleDefinition[] = [
  {
    id: 'rw-module-1',
    label: 'Reading & Writing — Module 1',
    section: 'reading_writing',
    questionCount: 27,
    timeLimitSeconds: 32 * 60, // 32 minutes
    calculatorAllowed: false,
    adaptive: false,
  },
  {
    id: 'rw-module-2',
    label: 'Reading & Writing — Module 2',
    section: 'reading_writing',
    questionCount: 27,
    timeLimitSeconds: 32 * 60,
    calculatorAllowed: false,
    adaptive: true,
  },
  {
    id: 'math-module-1',
    label: 'Math — Module 1',
    section: 'math',
    questionCount: 22,
    timeLimitSeconds: 35 * 60, // 35 minutes
    calculatorAllowed: true,
    adaptive: false,
  },
  {
    id: 'math-module-2',
    label: 'Math — Module 2',
    section: 'math',
    questionCount: 22,
    timeLimitSeconds: 35 * 60,
    calculatorAllowed: true,
    adaptive: true,
  },
];

// Standalone timed section options (Module 1 of each section)
export const TIMED_SECTION_OPTIONS = SAT_MODULES.filter((m) => !m.adaptive);

// ============================================
// Full practice test sequence
// ============================================

export type FullTestStage =
  | { kind: 'module'; moduleId: string }
  | { kind: 'break'; seconds: number };

/** Official digital SAT order: RW 1, RW 2, 10-minute break, Math 1, Math 2 */
export const FULL_TEST_SEQUENCE: FullTestStage[] = [
  { kind: 'module', moduleId: 'rw-module-1' },
  { kind: 'module', moduleId: 'rw-module-2' },
  { kind: 'break', seconds: 10 * 60 },
  { kind: 'module', moduleId: 'math-module-1' },
  { kind: 'module', moduleId: 'math-module-2' },
];

export interface FullTestStageResult {
  module_id: string;
  correct: number;
  total: number;
  accuracy: number;
  time_used_seconds: number;
}

/** Accuracy on a section's module 1 decides module 2's difficulty mix. */
export function biasFromModule1Accuracy(accuracy: number): 'harder' | 'easier' {
  return accuracy >= 0.6 ? 'harder' : 'easier';
}

// ============================================
// Pacing thresholds
// ============================================

export const PACING_THRESHOLDS = {
  math: {
    timeSinkSeconds: 90,
    rushSeconds: 15,
    idealAverageSeconds: 60,
  },
  reading_writing: {
    timeSinkSeconds: 75,
    rushSeconds: 10,
    idealAverageSeconds: 50,
  },
} as const;

// ============================================
// Effective module size (cap to available pool)
// ============================================

export async function getEffectiveModuleSize(
  section: 'math' | 'reading_writing',
  requestedCount: number
): Promise<{ effectiveCount: number; availableCount: number }> {
  const supabase = createServerClient();

  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('section', section);

  const availableCount = count ?? 0;
  const effectiveCount = Math.min(requestedCount, availableCount);

  return { effectiveCount, availableCount };
}

export function getModuleById(moduleId: string): ModuleDefinition | undefined {
  return SAT_MODULES.find((m) => m.id === moduleId);
}
