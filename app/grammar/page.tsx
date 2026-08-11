export const dynamic = 'force-dynamic';

import { createServerClient } from '@/lib/supabase';
import { GRAMMAR_RULES, GRAMMAR_TAG_PREFIX } from '@/lib/grammar-rules';
import { GrammarMapClient, type RuleStats } from '@/components/grammar-map-client';
import type { Question, QuestionAttempt } from '@/lib/types';

export default async function GrammarPage() {
  const supabase = createServerClient();

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .limit(1)
    .single();
  const studentId = student?.id ?? '';

  // All conventions questions and their tags
  const { data: questions } = await supabase
    .from('questions')
    .select('question_id, sub_skill_id, tags')
    .in('sub_skill_id', ['RW-10', 'RW-11']);

  const typedQuestions = (questions ?? []) as Pick<
    Question,
    'question_id' | 'sub_skill_id' | 'tags'
  >[];

  const ruleByQuestion = new Map<string, string>();
  let taggedCount = 0;
  for (const q of typedQuestions) {
    const tag = (q.tags ?? []).find((t) => t.startsWith(GRAMMAR_TAG_PREFIX));
    if (tag) {
      ruleByQuestion.set(q.question_id, tag.slice(GRAMMAR_TAG_PREFIX.length));
      taggedCount++;
    }
  }

  // The student's attempts on those questions
  const questionIds = typedQuestions.map((q) => q.question_id);
  let attempts: Pick<QuestionAttempt, 'question_id' | 'is_correct'>[] = [];
  if (questionIds.length > 0) {
    const { data: attemptRows } = await supabase
      .from('question_attempts')
      .select('question_id, is_correct')
      .eq('student_id', studentId)
      .in('question_id', questionIds);
    attempts = (attemptRows ?? []) as typeof attempts;
  }

  const stats = new Map<string, RuleStats>();
  for (const rule of GRAMMAR_RULES) {
    stats.set(rule.tag, { attempted: 0, correct: 0, questionCount: 0 });
  }
  for (const q of typedQuestions) {
    const ruleTag = ruleByQuestion.get(q.question_id);
    if (ruleTag && stats.has(ruleTag)) stats.get(ruleTag)!.questionCount++;
  }
  for (const a of attempts) {
    const ruleTag = ruleByQuestion.get(a.question_id);
    if (ruleTag && stats.has(ruleTag)) {
      const s = stats.get(ruleTag)!;
      s.attempted++;
      if (a.is_correct) s.correct++;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Grammar Rule Map</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Standard English Conventions, broken into the specific rules the SAT
          actually tests. Each rule has a 60-second lesson and a focused drill.
        </p>
      </div>
      <GrammarMapClient
        studentId={studentId}
        statsByTag={Object.fromEntries(stats)}
        untaggedCount={typedQuestions.length - taggedCount}
      />
    </div>
  );
}
