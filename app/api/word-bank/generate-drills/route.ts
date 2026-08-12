import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@/lib/supabase';
import { loadPrompt, interpolatePrompt } from '@/lib/prompt-utils';
import { MODELS } from '@/lib/claude';
import { CLUE_TYPES, CHARGES } from '@/lib/context-clues';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PER_WORD = 2;
const WORDS_PER_CALL = 5;
const DAILY_WORD_CAP = 20;

interface WordRow {
  id: string;
  word: string;
  normalized_word: string;
  context_sentence: string | null;
}

interface GeneratedDrill {
  word: string;
  question_text: string;
  passage_text: string;
  answer_choices: Record<string, string>;
  correct_answer: string;
  difficulty: number;
  distractor_analysis: Record<string, string>;
  explanation: string;
}

function isValidDrill(q: unknown): q is GeneratedDrill {
  if (typeof q !== 'object' || q === null) return false;
  const g = q as Record<string, unknown>;
  const choices = g.answer_choices as Record<string, string> | undefined;
  return (
    typeof g.word === 'string' &&
    typeof g.question_text === 'string' &&
    typeof g.passage_text === 'string' &&
    g.passage_text.includes('______') &&
    typeof choices === 'object' &&
    choices !== null &&
    ['A', 'B', 'C', 'D'].every((k) => typeof choices[k] === 'string') &&
    typeof g.correct_answer === 'string' &&
    ['A', 'B', 'C', 'D'].includes(g.correct_answer) &&
    typeof g.explanation === 'string'
  );
}

/**
 * Generate Words-in-Context drills for banked words that don't have any yet.
 * Student-triggered (no parent gate). Generated questions enter the review
 * queue due tomorrow, so the existing spaced-repetition loop schedules them.
 *
 * Body: { student_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id } = body;
    if (!student_id) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Daily cost cap: words drilled in the last 24h count against the budget
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: generatedToday } = await supabase
      .from('word_bank')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student_id)
      .gte('drills_generated_at', dayAgo);

    const budget = Math.max(0, DAILY_WORD_CAP - (generatedToday ?? 0));
    if (budget === 0) {
      return NextResponse.json({
        generated: 0,
        words_drilled: 0,
        message: 'Daily generation limit reached - try again tomorrow',
      });
    }

    const { data: pendingWords } = await supabase
      .from('word_bank')
      .select('id, word, normalized_word, context_sentence')
      .eq('student_id', student_id)
      .eq('status', 'active')
      .eq('drills_generated', false)
      .order('added_at', { ascending: true })
      .limit(Math.min(WORDS_PER_CALL, budget));

    const words = (pendingWords ?? []) as WordRow[];
    if (words.length === 0) {
      return NextResponse.json({
        generated: 0,
        words_drilled: 0,
        message: 'All banked words already have drills',
      });
    }

    const promptTemplate = loadPrompt('generate-vocab-drills');
    const systemPrompt = interpolatePrompt(promptTemplate, {
      per_word: String(PER_WORD),
      difficulty: '3',
      words_json: JSON.stringify(
        words.map((w) => ({ word: w.word, context: w.context_sentence })),
        null,
        2
      ),
    });

    const response = await anthropic.messages.create({
      model: MODELS.OPUS,
      max_tokens: 12000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Write ${words.length * PER_WORD} questions now. JSON array only.`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text : '[]';
    const jsonString = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return NextResponse.json(
        { error: 'Model returned unparseable drills - try again' },
        { status: 502 }
      );
    }

    const wordByText = new Map(words.map((w) => [w.word.toLowerCase(), w]));
    const candidates = (Array.isArray(parsed) ? parsed : [])
      .filter(isValidDrill)
      .filter((q) => wordByText.has(q.word.toLowerCase()));

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No valid drills generated - try again' },
        { status: 502 }
      );
    }

    const validClues = new Set(CLUE_TYPES.map((c) => c.tag));
    const validCharges = new Set<string>(CHARGES);
    const stamp = Date.now().toString(36);
    const rows = candidates.map((q, i) => {
      const wordRow = wordByText.get(q.word.toLowerCase())!;
      const extra = q as unknown as { clue_type?: string; charge?: string };
      const detectiveTags = [
        ...(validClues.has(extra.clue_type ?? '') ? [`clue:${extra.clue_type}`] : []),
        ...(validCharges.has(extra.charge ?? '') ? [`charge:${extra.charge}`] : []),
      ];
      return {
        question_id: `q_wb_${wordRow.normalized_word.replace(/[^a-z]/g, '')}_${stamp}_${i + 1}`,
        source: 'ai_generated',
        section: 'reading_writing',
        sub_skill_id: 'RW-05',
        difficulty: Math.min(Math.max(Math.round(q.difficulty) || 3, 1), 5),
        question_text: q.question_text,
        passage_id: null,
        passage_text: q.passage_text,
        answer_choices: q.answer_choices,
        correct_answer: q.correct_answer,
        distractor_analysis: q.distractor_analysis ?? {},
        explanation: q.explanation,
        is_ai_generated: true,
        tags: [`vocab:${wordRow.normalized_word}`, ...detectiveTags],
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(rows)
      .select('question_id');

    if (insertError) {
      console.error('Failed to insert vocab drills:', insertError);
      return NextResponse.json({ error: 'Failed to save drills' }, { status: 500 });
    }

    // Seed the review queue: due tomorrow, standard interval start
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const reviewRows = (inserted ?? []).map((r) => ({
      student_id,
      question_id: (r as { question_id: string }).question_id,
      next_review_date: tomorrowStr,
      review_count: 0,
      interval_days: 1,
    }));
    if (reviewRows.length > 0) {
      const { error: reviewError } = await supabase.from('review_queue').insert(reviewRows);
      if (reviewError) console.error('Failed to seed review queue:', reviewError);
    }

    // Mark drilled words
    const drilledWordIds = [
      ...new Set(candidates.map((q) => wordByText.get(q.word.toLowerCase())!.id)),
    ];
    const now = new Date().toISOString();
    for (const id of drilledWordIds) {
      await supabase
        .from('word_bank')
        .update({ drills_generated: true, drills_generated_at: now })
        .eq('id', id);
    }

    return NextResponse.json({
      generated: (inserted ?? []).length,
      words_drilled: drilledWordIds.length,
      remaining_words: Math.max(0, words.length - drilledWordIds.length),
    });
  } catch (error) {
    console.error('Vocab drill generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
