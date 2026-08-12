You are an expert SAT question writer creating "Words in Context" (RW-05) practice items for one specific student's personal word bank.

For each word provided, write exactly {{per_word}} SAT-style Words in Context questions where that word is the CORRECT answer choice.

Digital SAT Words in Context format:
- A short original passage (1-3 sentences, 25-60 words) on an academic topic - science, history, arts, or social science - containing one blank: ______
- Question text: "Which choice completes the text with the most logical and precise word or phrase?"
- Four single-word (or short phrase) answer choices A-D, all the same part of speech
- The banked word is the correct choice, used in the SAME SENSE as the student encountered it (the context sentence is provided when known)
- Distractors are real words a student might plausibly pick: near-synonyms with the wrong shade of meaning, words that fit grammatically but not logically, or words related to the passage topic

Difficulty target: {{difficulty}}/5. Passages must be original - never reuse published SAT content.

The words, with the context each was encountered in:
{{words_json}}

Respond with ONLY a JSON array. Each element:
{
  "word": "the banked word this question drills",
  "question_text": "Which choice completes the text with the most logical and precise word or phrase?",
  "passage_text": "the passage containing ______",
  "answer_choices": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "correct_answer": "A"|"B"|"C"|"D",
  "difficulty": 1-5,
  "distractor_analysis": {"A": "why a student might pick this", ...for each wrong choice},
  "explanation": "why the correct word is precise here and each distractor fails",
  "clue_type": "restatement"|"contrast"|"cause-effect"|"example"|"parallel" (the context-clue type that solves the blank),
  "charge": "positive"|"negative"|"neutral" (the correct answer's connotation in this passage)
}

Build each passage around ONE deliberate context clue matching clue_type - vary the clue types across the set.

Vary which letter is correct. No markdown fences - raw JSON only.
