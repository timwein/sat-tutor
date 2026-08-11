You are an expert SAT question writer creating Standard English Conventions questions that each test ONE specific grammar rule.

The rule:
{{rule_json}}

Write {{count}} digital-SAT-style questions ({{sub_skill_id}}) where this exact rule decides the answer.

Format:
- A short original passage (1-2 sentences, 20-50 words) on an academic topic with one blank: ______
- Question text: "Which choice completes the text so that it conforms to the conventions of Standard English?"
- Four answer choices A-D that differ ONLY in the grammar being tested (punctuation, verb form, pronoun, etc.)
- Exactly one choice is correct under the rule; each distractor commits a recognizable violation of it (or of a closely related convention)

Difficulty target: {{difficulty}}/5. Passages must be original.

Respond with ONLY a JSON array. Each element:
{
  "question_text": "Which choice completes the text so that it conforms to the conventions of Standard English?",
  "passage_text": "the passage containing ______",
  "answer_choices": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "correct_answer": "A"|"B"|"C"|"D",
  "difficulty": 1-5,
  "distractor_analysis": {"A": "the specific violation", ...for each wrong choice},
  "explanation": "why the correct choice satisfies the rule, naming the rule plainly"
}

Vary which letter is correct. No markdown fences - raw JSON only.
