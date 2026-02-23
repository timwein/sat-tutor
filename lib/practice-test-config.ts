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
