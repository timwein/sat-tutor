import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAccessToken } from '@/lib/parent-auth';
import { createServerClient } from '@/lib/supabase';
import { loadPrompt, interpolatePrompt } from '@/lib/prompt-utils';
import { MODELS } from '@/lib/claude';
import { SKILL_TAXONOMY } from '@/lib/types';
import type { Question } from '@/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const allSkills = [
  ...SKILL_TAXONOMY.math.map((s) => ({ ...s, section: 'math' as const })),
  ...SKILL_TAXONOMY.reading_writing.map((s) => ({
    ...s,
    section: 'reading_writing' as const,
  })),
];

interface GeneratedQuestion {
  question_text: string;
  passage_text: string | null;
  answer_choices: Record<string, string>;
  correct_answer: string;
  difficulty: number;
  distractor_analysis: Record<string, string>;
  explanation: string;
}

function isValidGenerated(q: unknown): q is GeneratedQuestion {
  if (typeof q !== 'object' || q === null) return false;
  const g = q as Record<string, unknown>;
  const choices = g.answer_choices as Record<string, string> | undefined;
  return (
    typeof g.question_text === 'string' &&
    g.question_text.length > 10 &&
    typeof choices === 'object' &&
    choices !== null &&
    ['A', 'B', 'C', 'D'].every((k) => typeof choices[k] === 'string') &&
    typeof g.correct_answer === 'string' &&
    ['A', 'B', 'C', 'D'].includes(g.correct_answer) &&
    typeof g.explanation === 'string'
  );
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_access_token')?.value;
    if (!token || !verifyAccessToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sub_skill_id, count = 5, difficulty = 3 } = body;

    const skill = allSkills.find((s) => s.id === sub_skill_id);
    if (!skill) {
      return NextResponse.json({ error: 'Unknown sub_skill_id' }, { status: 400 });
    }
    const safeCount = Math.min(Math.max(Number(count) || 5, 1), 10);
    const safeDifficulty = Math.min(Math.max(Number(difficulty) || 3, 1), 5);

    const supabase = createServerClient();

    // A few existing questions as style anchors / duplicate guards
    const { data: existing } = await supabase
      .from('questions')
      .select('question_text')
      .eq('sub_skill_id', sub_skill_id)
      .limit(8);

    const promptTemplate = loadPrompt('generate-questions');
    const systemPrompt = interpolatePrompt(promptTemplate, {
      sub_skill_context: JSON.stringify(
        { id: skill.id, name: skill.name, section: skill.section },
        null,
        2
      ),
      difficulty: String(safeDifficulty),
      count: String(safeCount),
      existing_samples: JSON.stringify(
        (existing ?? []).map((q) => q.question_text),
        null,
        2
      ),
    });

    const response = await anthropic.messages.create({
      model: MODELS.OPUS,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Write ${safeCount} questions now. JSON array only.` },
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
        { error: 'Model returned unparseable questions - try again' },
        { status: 502 }
      );
    }

    const candidates = (Array.isArray(parsed) ? parsed : []).filter(isValidGenerated);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No valid questions generated - try again' },
        { status: 502 }
      );
    }

    const stamp = Date.now().toString(36);
    const rows = candidates.map((q, i) => ({
      question_id: `q_ai_${sub_skill_id.toLowerCase()}_${stamp}_${i + 1}`,
      source: 'ai_generated',
      section: skill.section,
      sub_skill_id,
      difficulty: Math.min(Math.max(Math.round(q.difficulty) || safeDifficulty, 1), 5),
      question_text: q.question_text,
      passage_id: null,
      passage_text: q.passage_text ?? null,
      answer_choices: q.answer_choices,
      correct_answer: q.correct_answer,
      distractor_analysis: q.distractor_analysis ?? {},
      explanation: q.explanation,
      is_ai_generated: true,
      tags: [],
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('questions')
      .insert(rows)
      .select('question_id');

    if (insertError) {
      console.error('Failed to insert generated questions:', insertError);
      return NextResponse.json(
        { error: 'Failed to save generated questions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      generated: (inserted ?? []).length,
      question_ids: (inserted ?? []).map((r) => (r as Question).question_id),
    });
  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
