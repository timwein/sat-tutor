You are an expert SAT tutor and learning analytics specialist. Analyze the following wrong answer data across 8 dimensions to identify the most impactful patterns and actionable insights.

## Student Summary
{{student_summary}}

## Skill Ratings
{{skill_ratings}}

## Wrong Answer Data (with pre-computed aggregations)
{{wrong_answer_data}}

## Analysis Instructions

Analyze across ALL 8 dimensions below. For each dimension, provide a finding, severity, trend, recommendation, and evidence question IDs.

### Dimension 1: Error Type Distribution
Analyze the distribution of the 7 error types (conceptual_gap, procedural_error, careless_rush, misread_comprehension, trap_answer, time_pressure, knowledge_gap). Identify the dominant error type and whether errors are concentrated or spread across types.

### Dimension 2: Sub-Skill Clustering
Group wrong answers by sub_skill_id. Cross-reference with Elo ratings to identify:
- Weak clusters: low Elo + many wrong answers
- Improving clusters: wrong answers but Elo trending upward
- Stagnant clusters: consistent errors over multiple sessions

### Dimension 3: Distractor Analysis
Analyze distractor_type patterns (partial_answer, sign_error, misapplied_formula, scope_error, sounds_right, wrong_variable, other). Which distractor types most frequently trap this student?

### Dimension 4: Question Structure Vulnerability
Look at question tags, section (math vs reading_writing), and passage presence. Does the student struggle more with word problems vs pure computation? Passage-based vs standalone questions?

### Dimension 5: Time-Based Patterns
Analyze time_spent_seconds distribution:
- Rushing: < 30 seconds
- Normal: 30-120 seconds
- Overthinking: > 120 seconds
Correlate speed with wrong answers. Look for session fatigue (more wrongs later in sessions).

### Dimension 6: Cross-Topic Interaction Effects
Look for:
- Post-error tilt: wrong answers clustering immediately after another wrong answer
- Overconfidence after streaks: wrong answers following correct answer streaks
- Difficulty transition effects: errors when switching between sub-skills

### Dimension 7: Reading Comprehension Sub-Patterns
For reading_writing section wrong answers only: which RW sub-skills cluster? Evidence vs inference errors? If no reading_writing wrong answers exist, note "insufficient data".

### Dimension 8: Confidence Calibration
Cross-reference confidence_level with correctness:
- Overconfidence ratio: confident + wrong / total confident
- Underconfidence ratio: guessing + correct / total guessing
- Overall calibration accuracy
If no confidence data exists, note "insufficient data".

## Output Format

Return ONLY valid JSON in this exact format. Rank top_insights by (severity × actionability). Include exactly 3 top insights. Include all 8 dimensions in dimension_details.

{
  "top_insights": [
    {
      "dimension": "dimension name",
      "finding": "2-3 sentence finding written for a teenager",
      "severity": "high | medium | low",
      "trend": "improving | stagnant | worsening",
      "recommendation": "specific, actionable recommendation for the student",
      "evidence_question_ids": ["q_id_1", "q_id_2"]
    }
  ],
  "dimension_details": {
    "error_type_distribution": {
      "finding": "...",
      "severity": "high | medium | low",
      "trend": "improving | stagnant | worsening",
      "recommendation": "...",
      "evidence_question_ids": []
    },
    "sub_skill_clustering": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] },
    "distractor_analysis": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] },
    "question_structure": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] },
    "time_patterns": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] },
    "cross_topic_interaction": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] },
    "reading_sub_patterns": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] },
    "confidence_calibration": { "finding": "...", "severity": "...", "trend": "...", "recommendation": "...", "evidence_question_ids": [] }
  }
}
