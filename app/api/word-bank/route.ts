import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z'-]/g, '');
}

/** List the student's word bank. Query: ?student_id= */
export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get('student_id');
    if (!studentId) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('word_bank')
      .select('*')
      .eq('student_id', studentId)
      .order('added_at', { ascending: false });
    if (error) {
      return NextResponse.json({ error: 'Failed to load word bank' }, { status: 500 });
    }
    return NextResponse.json({ words: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Add a word. Body: { student_id, word, context_sentence?, source_question_id?,
 * source_label?, from_miss?, definition?, connotation?, part_of_speech?, usage_example? }
 * Idempotent per (student, normalized word): re-adding returns the existing row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, word } = body;
    if (!student_id || typeof word !== 'string' || !word.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, word' },
        { status: 400 }
      );
    }
    const cleaned = word.trim();
    if (cleaned.length > 40 || !/^[A-Za-z][A-Za-z' -]*$/.test(cleaned)) {
      return NextResponse.json({ error: 'Invalid word' }, { status: 400 });
    }
    const normalized = normalizeWord(cleaned);
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid word' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('word_bank')
      .select('*')
      .eq('student_id', student_id)
      .eq('normalized_word', normalized)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ word: existing, already_banked: true });
    }

    const { data: inserted, error } = await supabase
      .from('word_bank')
      .insert({
        student_id,
        word: cleaned,
        normalized_word: normalized,
        context_sentence: typeof body.context_sentence === 'string'
          ? body.context_sentence.slice(0, 400)
          : null,
        source_question_id: body.source_question_id ?? null,
        source_label: typeof body.source_label === 'string'
          ? body.source_label.slice(0, 120)
          : null,
        from_miss: body.from_miss === true,
        definition: typeof body.definition === 'string' ? body.definition : null,
        connotation: ['positive', 'negative', 'neutral'].includes(body.connotation)
          ? body.connotation
          : null,
        part_of_speech: typeof body.part_of_speech === 'string' ? body.part_of_speech : null,
        usage_example: typeof body.usage_example === 'string' ? body.usage_example : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add word:', error);
      return NextResponse.json({ error: 'Failed to add word' }, { status: 500 });
    }
    return NextResponse.json({ word: inserted, already_banked: false });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Update a word's status. Body: { word_id, status } */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { word_id, status } = body;
    if (!word_id || !['active', 'mastered', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'Invalid word_id or status' }, { status: 400 });
    }
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('word_bank')
      .update({ status })
      .eq('id', word_id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: 'Failed to update word' }, { status: 500 });
    }
    return NextResponse.json({ word: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
