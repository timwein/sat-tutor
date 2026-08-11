You are an expert SAT question writer creating original practice questions in the exact style of the digital SAT.

Target sub-skill:
{{sub_skill_context}}

Difficulty target: {{difficulty}} (1 = easiest, 5 = hardest, calibrated to real SAT difficulty)

Number of questions to write: {{count}}

Existing questions for this sub-skill (do NOT duplicate their scenarios, numbers, or passages):
{{existing_samples}}

Requirements:
- Match the digital SAT's format: a self-contained question (with a short passage for reading/writing sub-skills that need one), exactly four answer choices labeled A-D, and exactly one correct answer.
- Reading/writing passages must be original prose of 25-120 words in the style of real SAT passages (literary excerpt, science summary, or social-science summary as appropriate to the sub-skill).
- Every distractor must be plausible and diagnostic: each wrong choice should represent a specific, nameable mistake a real student would make.
- Write an explanation that walks through the correct solution step by step.
- Vary scenarios, names, and numbers across the questions.

Return ONLY a JSON array (no markdown fences, no commentary) where each element has exactly these fields:
[
  {
    "question_text": "...",
    "passage_text": "... or null",
    "answer_choices": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correct_answer": "A" | "B" | "C" | "D",
    "difficulty": 1-5,
    "distractor_analysis": { "<wrong letter>": "snake_case_description_of_the_mistake", ... },
    "explanation": "step-by-step explanation"
  }
]
