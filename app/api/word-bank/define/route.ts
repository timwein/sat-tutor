import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@/lib/supabase';
import { MODELS } from '@/lib/claude';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const VALID_CONNOTATIONS = new Set(['positive', 'negative', 'neutral']);

interface Definition {
  definition: string;
  connotation: 'positive' | 'negative' | 'neutral';
  part_of_speech: string;
  usage_example: string;
}

async function defineWord(word: string, sentence: string | null): Promise<Definition | null> {
  const response = await anthropic.messages.create({
    model: MODELS.SONNET,
    max_tokens: 500,
    system: [
      {
        type: 'text' as const,
        text: 'You are a vocabulary coach for a high-school student preparing for the SAT. Given a word (and optionally the sentence it appeared in), define the sense used in that context. Respond with ONLY a JSON object: {"definition": "concise student-friendly definition of the in-context sense", "connotation": "positive"|"negative"|"neutral", "part_of_speech": "noun"|"verb"|"adjective"|"adverb"|..., "usage_example": "one original SAT-style sentence using the word in the same sense"}',
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      {
        role: 'user',
        content: sentence
          ? `Word: "${word}"\nAs used in: "${sentence}"`
          : `Word: "${word}"`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const raw = textBlock?.type === 'text' ? textBlock.text : '';
  const jsonString = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;
    if (
      typeof parsed.definition !== 'string' ||
      typeof parsed.usage_example !== 'string'
    ) {
      return null;
    }
    return {
      definition: parsed.definition,
      connotation: VALID_CONNOTATIONS.has(parsed.connotation as string)
        ? (parsed.connotation as Definition['connotation'])
        : 'neutral',
      part_of_speech:
        typeof parsed.part_of_speech === 'string' ? parsed.part_of_speech : '',
      usage_example: parsed.usage_example,
    };
  } catch {
    return null;
  }
}

/**
 * Define a word in context (for the tap popover), or backfill the
 * definition of an existing word_bank row (auto-banked misses).
 *
 * Body: { word, sentence? } or { word_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    if (typeof body.word_id === 'string') {
      const { data: row } = await supabase
        .from('word_bank')
        .select('*')
        .eq('id', body.word_id)
        .single();
      if (!row) {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 });
      }
      if (row.definition) {
        return NextResponse.json({ definition: row });
      }
      const def = await defineWord(row.word, row.context_sentence);
      if (!def) {
        return NextResponse.json({ error: 'Definition unavailable - try again' }, { status: 502 });
      }
      const { data: updated } = await supabase
        .from('word_bank')
        .update({
          definition: def.definition,
          connotation: def.connotation,
          part_of_speech: def.part_of_speech,
          usage_example: def.usage_example,
        })
        .eq('id', row.id)
        .select()
        .single();
      return NextResponse.json({ definition: updated ?? row });
    }

    const word = typeof body.word === 'string' ? body.word.trim() : '';
    if (!word || word.length > 40 || !/^[A-Za-z][A-Za-z'-]*$/.test(word)) {
      return NextResponse.json({ error: 'Invalid word' }, { status: 400 });
    }
    const sentence =
      typeof body.sentence === 'string' ? body.sentence.slice(0, 400) : null;

    const def = await defineWord(word, sentence);
    if (!def) {
      return NextResponse.json({ error: 'Definition unavailable - try again' }, { status: 502 });
    }
    return NextResponse.json({ word, ...def });
  } catch (error) {
    console.error('Define word error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
