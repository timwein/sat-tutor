import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@/lib/supabase';
import { loadPrompt, interpolatePrompt } from '@/lib/prompt-utils';
import { MODELS } from '@/lib/claude';
import { getGrammarRule, GRAMMAR_TAG_PREFIX } from '@/lib/grammar-rules';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DRILL_SIZE = 10;

interface GeneratedItem {
  question_text: string;
  passage_text: string;
  answer_choices: Record<string, string>;
  correct_answer: string;
  difficulty: number;
  distractor_analysis: Record<string, string>;
  explanation: string;
}

function isValidItem(q: unknown): q is GeneratedItem {
  if (typeof q !== 'object' || q === null) return false;
  const g = q as Record<string, unknown>;
  const choices = g.answer_choices as Record<string, string> | undefined;
  return (
    typeof g.question_text === 'string' &&
    typeof g.passage_text === 'string' &&
    typeof choices === 'object' &&
    choices !== null &&
    ['A', 'B', 'C', 'D'].every((k) => typeof choices[k] === 'string') &&
    typeof g.correct_answer === 'string' &&
    ['A', 'B', 'C', 'D'].includes(g.correct_answer) &&
    typeof g.explanation === 'string'
  );
}

/**
 * Start a drill for one named grammar rule. Fills thin coverage with
 * AI-generated on-rule questions first, then creates a quick-drill session
 * whose question selection is pinned to the rule's tag.
 *
 * Body: { student_id, rule: '<rule id or tag>' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, rule: ruleParam } = body;
    if (!student_id || !ruleParam) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, rule' },
        { status: 400 }
      );
    }
    const rule = getGrammarRule(ruleParam);
    if (!rule) {
      return NextResponse.json({ error: 'Unknown grammar rule' }, { status: 400 });
    }
    const tag = `${GRAMMAR_TAG_PREFIX}${rule.tag}`;

    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('questions')
      .select('question_id')
      .contains('tags', [tag]);
    const existingCount = (existing ?? []).length;

    let generated = 0;
    if (existingCount < DRILL_SIZE) {
      const need = Math.min(DRILL_SIZE - existingCount, 10);
      const promptTemplate = loadPrompt('generate-grammar-drills');
      const systemPrompt = interpolatePrompt(promptTemplate, {
        rule_json: JSON.stringify(
          {
            name: rule.name,
            rule: rule.rule,
            wrong_example: rule.wrongExample,
            fixed_example: rule.fixedExample,
            common_trap: rule.trap,
          },
          null,
          2
        ),
        count: String(need),
        sub_skill_id: rule.subSkillId,
        difficulty: '3',
      });

      const response = await anthropic.messages.create({
        model: MODELS.OPUS,
        max_tokens: 12000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Write ${need} questions now. JSON array only.` },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      const raw = textBlock?.type === 'text' ? textBlock.text : '[]';
      const jsonString = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(jsonString);
      } catch {
        // Generation failed; drill proceeds with whatever exists
      }
      const candidates = (Array.isArray(parsed) ? parsed : []).filter(isValidItem);

      if (candidates.length > 0) {
        const stamp = Date.now().toString(36);
        const rows = candidates.map((q, i) => ({
          question_id: `q_gr_${rule.tag.replace(/[^a-z]/g, '')}_${stamp}_${i + 1}`,
          source: 'ai_generated',
          section: 'reading_writing',
          sub_skill_id: rule.subSkillId,
          difficulty: Math.min(Math.max(Math.round(q.difficulty) || 3, 1), 5),
          question_text: q.question_text,
          passage_id: null,
          passage_text: q.passage_text,
          answer_choices: q.answer_choices,
          correct_answer: q.correct_answer,
          distractor_analysis: q.distractor_analysis ?? {},
          explanation: q.explanation,
          is_ai_generated: true,
          tags: [tag],
        }));
        const { data: inserted, error: insertError } = await supabase
          .from('questions')
          .insert(rows)
          .select('question_id');
        if (insertError) {
          console.error('Failed to insert grammar drills:', insertError);
        } else {
          generated = (inserted ?? []).length;
        }
      }
    }

    if (existingCount + generated === 0) {
      return NextResponse.json(
        { error: 'No questions available for this rule yet - try again' },
        { status: 502 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        student_id,
        session_type: 'quick_drill',
        metadata: { mode: 'grammar', drill_tag: tag, grammar_rule: rule.id },
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Failed to create grammar drill session:', sessionError);
      return NextResponse.json({ error: 'Failed to start drill' }, { status: 500 });
    }

    return NextResponse.json({
      session_id: session.id,
      available_questions: existingCount + generated,
      generated,
    });
  } catch (error) {
    console.error('Grammar drill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
