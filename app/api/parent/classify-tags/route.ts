import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAccessToken } from '@/lib/parent-auth';
import { createServerClient } from '@/lib/supabase';
import { MODELS } from '@/lib/claude';
import { GRAMMAR_RULES, GRAMMAR_TAG_PREFIX } from '@/lib/grammar-rules';
import { LOGIC_RELATIONSHIPS, LOGIC_TAG_PREFIX } from '@/lib/logic-relationships';
import {
  CLUE_TYPES,
  CLUE_TAG_PREFIX,
  CHARGE_TAG_PREFIX,
  CHARGES,
} from '@/lib/context-clues';
import type { Question } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const BATCH_SIZE = 15;
const CONCURRENCY = 3;

interface ClassifyConfig {
  subSkillIds: string[];
  tagPrefix: string;
  validTags: Set<string>;
  taxonomyPrompt: string;
}

// Word Detective: each RW-05 question gets TWO tags - the context-clue type
// that solves it, and the charge (connotation) of the correct answer in
// context. Handled separately from the single-tag kinds below.
async function classifyDetectiveBatch(
  batch: Question[]
): Promise<Map<string, { clue: string; charge: string }>> {
  const items = batch.map((q) => ({
    question_id: q.question_id,
    passage_text: q.passage_text ? q.passage_text.slice(0, 600) : null,
    question_text: q.question_text,
    answer_choices: q.answer_choices,
    correct_answer: q.correct_answer,
  }));

  const clueTaxonomy = CLUE_TYPES.map(
    (c) => `- ${c.tag}: ${c.name}. ${c.definition} Signals: ${c.signalWords.join(', ')}.`
  ).join('\n');

  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 2500,
    system: [
      {
        type: 'text' as const,
        text: `You analyze SAT Words-in-Context questions. For each question, identify:\n1. "clue": the single context-clue type a student would use to solve it:\n${clueTaxonomy}\n2. "charge": the connotation of the correct answer AS USED in the passage: "positive", "negative", or "neutral".\n\nRespond with ONLY a JSON object mapping question_id to {"clue": "<tag>", "charge": "<charge>"}. Use only tags from the lists.`,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const raw = textBlock?.type === 'text' ? textBlock.text : '{}';
  const jsonString = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  const validClues = new Set(CLUE_TYPES.map((c) => c.tag));
  const validCharges = new Set<string>(CHARGES);
  const result = new Map<string, { clue: string; charge: string }>();
  try {
    const parsed = JSON.parse(jsonString) as Record<string, { clue?: string; charge?: string }>;
    for (const [qid, v] of Object.entries(parsed)) {
      if (v && validClues.has(v.clue ?? '') && validCharges.has(v.charge ?? '')) {
        result.set(qid, { clue: v.clue!, charge: v.charge! });
      }
    }
  } catch {
    // Unparseable batch - skip; re-run picks these up
  }
  return result;
}

function buildConfig(kind: 'grammar' | 'logic'): ClassifyConfig {
  if (kind === 'grammar') {
    return {
      subSkillIds: ['RW-10', 'RW-11'],
      tagPrefix: GRAMMAR_TAG_PREFIX,
      validTags: new Set(GRAMMAR_RULES.map((r) => r.tag)),
      taxonomyPrompt: GRAMMAR_RULES.map(
        (r) => `- ${r.tag}: ${r.name}. ${r.rule}`
      ).join('\n'),
    };
  }
  return {
    subSkillIds: ['RW-09'],
    tagPrefix: LOGIC_TAG_PREFIX,
    validTags: new Set(LOGIC_RELATIONSHIPS.map((r) => r.tag)),
    taxonomyPrompt: LOGIC_RELATIONSHIPS.map(
      (r) =>
        `- ${r.tag}: ${r.name}. ${r.definition} Signal words: ${r.signalWords.join(', ')}.`
    ).join('\n'),
  };
}

async function classifyBatch(
  batch: Question[],
  config: ClassifyConfig
): Promise<Map<string, string>> {
  const items = batch.map((q) => ({
    question_id: q.question_id,
    question_text: q.question_text,
    passage_text: q.passage_text ? q.passage_text.slice(0, 600) : null,
    correct_answer_text:
      (q.answer_choices as Record<string, string>)[q.correct_answer] ?? null,
  }));

  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 2000,
    system: [
      {
        type: 'text' as const,
        text: `You classify SAT questions into exactly one category each. Categories:\n${config.taxonomyPrompt}\n\nRespond with ONLY a JSON object mapping question_id to category tag. Every question gets the single best-fitting tag from the list above - never invent a tag.`,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user', content: JSON.stringify(items) }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const raw = textBlock?.type === 'text' ? textBlock.text : '{}';
  const jsonString = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  const result = new Map<string, string>();
  try {
    const parsed = JSON.parse(jsonString) as Record<string, string>;
    for (const [qid, tag] of Object.entries(parsed)) {
      if (config.validTags.has(tag)) result.set(qid, tag);
    }
  } catch {
    // Unparseable batch - skip; questions stay untagged and re-run picks them up
  }
  return result;
}

/**
 * Tag questions with grammar-rule or logic-relationship categories.
 * Parent-gated. Idempotent: only untagged questions are processed, so
 * re-running as the bank grows is safe.
 *
 * Body: { kind: 'grammar' | 'logic', preview?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;
    if (!token || !verifyAccessToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const kind = body.kind as 'grammar' | 'logic' | 'detective';
    if (kind !== 'grammar' && kind !== 'logic' && kind !== 'detective') {
      return NextResponse.json(
        { error: 'kind must be grammar, logic, or detective' },
        { status: 400 }
      );
    }

    if (kind === 'detective') {
      const supabaseDet = createServerClient();
      const { data: wicQuestions, error: wicError } = await supabaseDet
        .from('questions')
        .select('*')
        .eq('sub_skill_id', 'RW-05');
      if (wicError) {
        return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
      }
      const allWic = (wicQuestions ?? []) as Question[];
      const untaggedWic = allWic.filter(
        (q) => !(q.tags ?? []).some((t) => t.startsWith(CLUE_TAG_PREFIX))
      );
      if (body.preview === true) {
        return NextResponse.json({
          total: allWic.length,
          already_tagged: allWic.length - untaggedWic.length,
          to_classify: untaggedWic.length,
        });
      }
      if (untaggedWic.length === 0) {
        return NextResponse.json({ classified: 0, total: allWic.length, message: 'Nothing to classify' });
      }
      const wicBatches: Question[][] = [];
      for (let i = 0; i < untaggedWic.length; i += BATCH_SIZE) {
        wicBatches.push(untaggedWic.slice(i, i + BATCH_SIZE));
      }
      const detAssignments = new Map<string, { clue: string; charge: string }>();
      for (let i = 0; i < wicBatches.length; i += CONCURRENCY) {
        const chunk = wicBatches.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map((b) => classifyDetectiveBatch(b)));
        for (const r of results) for (const [k, v] of r) detAssignments.set(k, v);
      }
      let updatedCount = 0;
      for (const q of untaggedWic) {
        const assignment = detAssignments.get(q.question_id);
        if (!assignment) continue;
        const newTags = [
          ...(q.tags ?? []).filter(
            (t) => !t.startsWith(CLUE_TAG_PREFIX) && !t.startsWith(CHARGE_TAG_PREFIX)
          ),
          `${CLUE_TAG_PREFIX}${assignment.clue}`,
          `${CHARGE_TAG_PREFIX}${assignment.charge}`,
        ];
        const { error: updateError } = await supabaseDet
          .from('questions')
          .update({ tags: newTags })
          .eq('question_id', q.question_id);
        if (!updateError) updatedCount++;
      }
      return NextResponse.json({
        classified: updatedCount,
        skipped: untaggedWic.length - updatedCount,
        total: allWic.length,
      });
    }

    const config = buildConfig(kind);

    const supabase = createServerClient();
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .in('sub_skill_id', config.subSkillIds);

    if (error) {
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
    }

    const all = (questions ?? []) as Question[];
    const untagged = all.filter(
      (q) => !(q.tags ?? []).some((t) => t.startsWith(config.tagPrefix))
    );

    if (body.preview === true) {
      return NextResponse.json({
        total: all.length,
        already_tagged: all.length - untagged.length,
        to_classify: untagged.length,
      });
    }

    if (untagged.length === 0) {
      return NextResponse.json({ classified: 0, total: all.length, message: 'Nothing to classify' });
    }

    const batches: Question[][] = [];
    for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
      batches.push(untagged.slice(i, i + BATCH_SIZE));
    }

    const assignments = new Map<string, string>();
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((b) => classifyBatch(b, config)));
      for (const r of results) for (const [k, v] of r) assignments.set(k, v);
    }

    let updated = 0;
    for (const q of untagged) {
      const tag = assignments.get(q.question_id);
      if (!tag) continue;
      const newTags = [...(q.tags ?? []), `${config.tagPrefix}${tag}`];
      const { error: updateError } = await supabase
        .from('questions')
        .update({ tags: newTags })
        .eq('question_id', q.question_id);
      if (!updateError) updated++;
    }

    return NextResponse.json({
      classified: updated,
      skipped: untagged.length - updated,
      total: all.length,
    });
  } catch (error) {
    console.error('Tag classification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
