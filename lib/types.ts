// ============================================
// Database types matching Supabase schema
// ============================================

export interface Student {
  id: string;
  name: string;
  email: string | null;
  parent_email: string | null;
  created_at: string;
  settings: Record<string, unknown>;
}

export interface SkillRating {
  id: string;
  student_id: string;
  sub_skill_id: string;
  elo_rating: number;
  questions_attempted: number;
  questions_correct: number;
  is_calibrated: boolean;
  last_updated: string;
}

export interface Question {
  id: string;
  question_id: string;
  source: string;
  section: 'math' | 'reading_writing';
  sub_skill_id: string;
  difficulty: number;
  question_text: string;
  passage_id: string | null;
  passage_text: string | null;
  answer_choices: Record<string, string>;
  correct_answer: string;
  distractor_analysis: Record<string, string>;
  explanation: string | null;
  is_ai_generated: boolean;
  tags: string[];
  created_at: string;
}

export interface Session {
  id: string;
  student_id: string;
  session_type: 'quick_drill' | 'study_session' | 'timed_section' | 'full_practice_test';
  started_at: string;
  ended_at: string | null;
  questions_answered: number;
  questions_correct: number;
  accuracy: number | null;
  summary: string | null;
  mood_signals: unknown[];
  sub_skills_practiced: string[];
  metadata?: Record<string, unknown> | null;
}

export interface QuestionAttempt {
  id: string;
  student_id: string;
  session_id: string;
  question_id: string;
  student_answer: string;
  is_correct: boolean;
  time_spent_seconds: number | null;
  confidence_level: 'guessing' | 'okay' | 'confident' | null;
  error_type: string | null;
  distractor_type: string | null;
  error_explanation: string | null;
  explanation_strategy_used: string | null;
  attempted_at: string;
}

export interface ReviewQueueItem {
  id: string;
  student_id: string;
  question_id: string;
  next_review_date: string;
  review_count: number;
  last_review_result: boolean | null;
  interval_days: number;
}

export interface WrongAnswerInsight {
  id: string;
  student_id: string;
  generated_at: string;
  total_wrong_answers_analyzed: number;
  top_insights: InsightItem[];
  dimension_details: Record<string, DimensionDetail>;
  raw_analysis: string | null;
}

export interface InsightItem {
  dimension: string;
  finding: string;
  severity: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stagnant' | 'worsening';
  recommendation: string;
  evidence_question_ids: string[];
}

export interface DimensionDetail {
  finding: string;
  evidence_question_ids: string[];
  severity: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stagnant' | 'worsening';
  recommendation: string;
}

export interface ScorePrediction {
  id: string;
  student_id: string;
  predicted_at: string;
  total_score_low: number;
  total_score_mid: number;
  total_score_high: number;
  rw_score: number;
  math_score: number;
  confidence: number;
}

export interface DailyActivity {
  id: string;
  student_id: string;
  activity_date: string;
  questions_answered: number;
  streak_qualifying: boolean;
}

export interface MicroGoal {
  id: string;
  student_id: string;
  week_start: string;
  goal_type: 'master_skills' | 'complete_drills' | 'reduce_errors' | 'accuracy_target' | 'study_streak' | 'review_queue';
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface ParentAlert {
  id: string;
  student_id: string;
  alert_type: 'study_gap' | 'skill_regression' | 'milestone';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ParentAccess {
  id: string;
  student_id: string;
  pin_hash: string;
  created_at: string;
  last_accessed_at: string | null;
}

// ============================================
// Skill taxonomy
// ============================================

export const SKILL_TAXONOMY = {
  reading_writing: [
    { id: 'RW-01', name: 'Central Ideas & Details', domain: 'Information and Ideas' },
    { id: 'RW-02', name: 'Command of Evidence (Textual)', domain: 'Information and Ideas' },
    { id: 'RW-03', name: 'Command of Evidence (Quantitative)', domain: 'Information and Ideas' },
    { id: 'RW-04', name: 'Inferences', domain: 'Information and Ideas' },
    { id: 'RW-05', name: 'Words in Context', domain: 'Craft and Structure' },
    { id: 'RW-06', name: 'Text Structure and Purpose', domain: 'Craft and Structure' },
    { id: 'RW-07', name: 'Cross-Text Connections', domain: 'Craft and Structure' },
    { id: 'RW-08', name: 'Rhetorical Synthesis', domain: 'Craft and Structure' },
    { id: 'RW-09', name: 'Transitions', domain: 'Expression of Ideas' },
    { id: 'RW-10', name: 'Boundaries (Sentences)', domain: 'Standard English Conventions' },
    { id: 'RW-11', name: 'Form, Structure, and Sense', domain: 'Standard English Conventions' },
  ],
  math: [
    { id: 'M-01', name: 'Linear Equations (one variable)', domain: 'Algebra' },
    { id: 'M-02', name: 'Linear Equations (two variables)', domain: 'Algebra' },
    { id: 'M-03', name: 'Linear Functions', domain: 'Algebra' },
    { id: 'M-04', name: 'Systems of Linear Equations', domain: 'Algebra' },
    { id: 'M-05', name: 'Linear Inequalities', domain: 'Algebra' },
    { id: 'M-06', name: 'Nonlinear Equations & Functions', domain: 'Advanced Math' },
    { id: 'M-07', name: 'Equivalent Expressions', domain: 'Advanced Math' },
    { id: 'M-08', name: 'Quadratics', domain: 'Advanced Math' },
    { id: 'M-09', name: 'Exponential Functions', domain: 'Advanced Math' },
    { id: 'M-10', name: 'Ratios, Rates, Proportions', domain: 'Problem Solving & Data' },
    { id: 'M-11', name: 'Percentages', domain: 'Problem Solving & Data' },
    { id: 'M-12', name: 'One-Variable Data (Statistics)', domain: 'Problem Solving & Data' },
    { id: 'M-13', name: 'Two-Variable Data (Scatterplots)', domain: 'Problem Solving & Data' },
    { id: 'M-14', name: 'Probability & Conditional Probability', domain: 'Problem Solving & Data' },
    { id: 'M-15', name: 'Inference from Sample Statistics', domain: 'Problem Solving & Data' },
    { id: 'M-16', name: 'Area and Volume', domain: 'Geometry & Trig' },
    { id: 'M-17', name: 'Lines, Angles, Triangles', domain: 'Geometry & Trig' },
    { id: 'M-18', name: 'Right Triangles & Trigonometry', domain: 'Geometry & Trig' },
    { id: 'M-19', name: 'Circles', domain: 'Geometry & Trig' },
  ],
} as const;

// ============================================
// Claude API types
// ============================================

export type TutorMode = 'socratic' | 'direct';

export type ExplanationStrategy =
  | 'algebraic_procedural'
  | 'visual_geometric'
  | 'plugin_backsolve'
  | 'real_world_analogy'
  | 'textual_evidence'
  | 'elimination_reasoning'
  | 'paraphrase_method'
  | 'pattern_recognition';

export interface ExplainRequest {
  question: Question;
  student_answer: string;
  mode: TutorMode;
  strategy?: ExplanationStrategy;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  student_profile?: Partial<StudentProfile>;
  /** When provided, the server builds a personalized profile for the tutor */
  student_id?: string;
  frustration_level?: 'none' | 'medium' | 'high';
}

export interface ExplainResponse {
  explanation: string;
  strategy_used: ExplanationStrategy;
}

// ============================================
// Session & Elo types
// ============================================

export type SessionPhase = 'warmup' | 'ramp' | 'peak' | 'easeoff' | 'endwin';
export type MasteryLevel = 'Developing' | 'Progressing' | 'Proficient' | 'Mastered';
export type SelectionCategory = 'lowest_rated' | 'spaced_repetition' | 'random';

export interface SessionConfig {
  type: 'quick_drill' | 'study_session' | 'timed_section' | 'full_practice_test';
  durationMinutes: number;
  maxQuestions: number;
}

/** Question sent to client — strips correct_answer, distractor_analysis, explanation */
export interface SafeQuestion {
  id: string;
  question_id: string;
  section: 'math' | 'reading_writing';
  sub_skill_id: string;
  difficulty: number;
  question_text: string;
  passage_text: string | null;
  answer_choices: Record<string, string>;
  tags: string[];
  is_ai_generated?: boolean;
}

export interface EloUpdate {
  sub_skill_id: string;
  sub_skill_name: string;
  previous_elo: number;
  new_elo: number;
  delta: number;
  mastery_level: MasteryLevel;
}

export interface AttemptResponse {
  is_correct: boolean;
  correct_answer: string;
  question: Question;
  elo_update: EloUpdate;
  error_classification: ErrorClassification | null;
  frustration_state: FrustrationState;
  session_stats: {
    questions_answered: number;
    questions_correct: number;
    accuracy: number;
  };
}

export interface ErrorClassification {
  error_type: string;
  explanation: string;
  distractor_type: string;
  what_student_likely_thought: string;
}

export interface FrustrationSignal {
  type: 'consecutive_wrong' | 'time_decreasing' | 'time_increasing' | 'skipping';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface FrustrationState {
  isFrustrated: boolean;
  signals: FrustrationSignal[];
  recommendation: 'continue' | 'normalize' | 'offer_choice' | 'switch_to_strength';
  consecutiveWrong: number;
}

export interface AttemptSignal {
  isCorrect: boolean;
  timeSpentSeconds: number | null;
  wasSkipped: boolean;
}

export interface QuestionSelectionResult {
  question: Question;
  category: SelectionCategory;
  targetSubSkill: string;
  targetDifficulty: number;
  reason: string;
}

// ============================================
// Claude API types
// ============================================

export interface StudentProfile {
  student_id: string;
  session_number: number;
  current_predicted_score: { total: number; rw: number; math: number };
  skill_ratings: Record<string, { elo: number; trend: string; calibrated: boolean }>;
  top_3_weaknesses: string[];
  session_state: {
    questions_answered: number;
    accuracy_this_session: number;
    current_mood_signal: string;
    consecutive_wrong: number;
    time_in_session_minutes: number;
  };
  learning_preferences: {
    preferred_explanation_style: string;
    socratic_mode: boolean;
  };
}

// ============================================
// Practice Test types
// ============================================

export interface ModuleDefinition {
  id: string;
  label: string;
  section: 'math' | 'reading_writing';
  questionCount: number;
  timeLimitSeconds: number;
  calculatorAllowed: boolean;
  adaptive: boolean;
}

export interface PracticeQuestionState {
  questionId: string;
  selectedAnswer: string | null;
  flagged: boolean;
  timeSpentMs: number;
  crossedOut: Set<string>;
  confidenceLevel: 'guessing' | 'okay' | 'confident' | null;
  annotations: AnnotationMark[];
}

export interface AnnotationMark {
  startOffset: number;
  endOffset: number;
  type: 'highlight' | 'underline';
  color: string;
}

export interface ModuleResult {
  sessionId: string;
  moduleId: string;
  section: 'math' | 'reading_writing';
  questionResults: QuestionResult[];
  totalCorrect: number;
  totalQuestions: number;
  accuracy: number;
  timeLimitSeconds: number;
  totalTimeUsedSeconds: number;
  pacingAnalysis: PacingAnalysis;
  eloUpdates: EloUpdate[];
}

export interface QuestionResult {
  questionId: string;
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  confidenceLevel: 'guessing' | 'okay' | 'confident' | null;
  errorClassification: ErrorClassification | null;
  question: Question;
}

export interface PacingAnalysis {
  averageTimeSeconds: number;
  medianTimeSeconds: number;
  paceRating: 'too_fast' | 'good' | 'too_slow';
  timeSinks: TimeSink[];
  rushWarnings: RushWarning[];
  quarterBreakdown: PaceQuarter[];
  recommendations: string[];
}

export interface TimeSink {
  questionId: string;
  timeSpentSeconds: number;
  thresholdSeconds: number;
  isCorrect: boolean;
}

export interface RushWarning {
  questionId: string;
  timeSpentSeconds: number;
  isCorrect: boolean;
}

export interface PaceQuarter {
  quarter: 1 | 2 | 3 | 4;
  questionCount: number;
  averageTimeSeconds: number;
  accuracy: number;
}
