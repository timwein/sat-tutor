Classify this wrong answer into exactly one error type. Return JSON only.

Error types:
- conceptual_gap: Student doesn't understand the underlying concept
- procedural_error: Understands concept but makes a mistake in execution
- careless_rush: Knew the material, went too fast
- misread_comprehension: Misunderstood what the question asked
- trap_answer: Fell for a deliberately tempting wrong answer
- time_pressure: Ran out of time or rushed due to pacing
- knowledge_gap: Missing a specific fact or formula

Question: {{question_text}}
Correct answer: {{correct_answer}}
Student answer: {{student_answer}}
Time spent: {{time_seconds}}s
Student confidence: {{confidence_level}}

Return ONLY valid JSON in this exact format:
{
  "error_type": "one_of_the_types_above",
  "explanation": "1 sentence explaining why this classification",
  "distractor_type": "partial_answer | sign_error | misapplied_formula | scope_error | sounds_right | wrong_variable | other",
  "what_student_likely_thought": "1 sentence on the student's probable reasoning"
}
