import type { Question } from './types';

/**
 * Answer formats.
 *
 * Multiple choice: `answer_choices` maps letters to text and `correct_answer`
 * is a letter.
 *
 * Student-produced response (the SAT "grid-in"): `answer_choices` is an empty
 * object and `correct_answer` is a number written as an integer, a decimal or
 * a fraction ("9", ".2", "45.125", "11/28", "-28"). When more than one value
 * is accepted they are separated by ";" ("30; -30").
 *
 * This module is shared by server routes and client components, so it must
 * stay free of server-only imports.
 */

export type QuestionFormat = 'multiple_choice' | 'student_produced';

type FormatSource = Pick<Question, 'answer_choices'>;
type GradeSource = Pick<Question, 'answer_choices' | 'correct_answer'>;

export function isStudentProduced(question: FormatSource): boolean {
  const choices = question.answer_choices;
  return !choices || typeof choices !== 'object' || Object.keys(choices).length === 0;
}

export function questionFormat(question: FormatSource): QuestionFormat {
  return isStudentProduced(question) ? 'student_produced' : 'multiple_choice';
}

/** Longest string a student may type into a grid-in field. */
export const GRID_IN_MAX_LENGTH = 10;

/** Keep only the characters a grid-in answer can contain: digits, ".", "/", "-". */
export function sanitizeGridInInput(raw: string): string {
  return raw.replace(/[^0-9./-]/g, '').slice(0, GRID_IN_MAX_LENGTH);
}

/** Every value a stored correct answer accepts ("30; -30" -> ["30", "-30"]). */
export function acceptedAnswers(correctAnswer: string): string[] {
  return correctAnswer
    .split(/\s*(?:;|\||\bor\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Human-readable form of a stored correct answer ("30; -30" -> "30 or -30"). */
export function formatAcceptedAnswers(correctAnswer: string): string {
  const values = acceptedAnswers(correctAnswer);
  return values.length > 0 ? values.join(' or ') : correctAnswer;
}

const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Parse an integer, decimal or fraction. Whitespace, thousands separators,
 * "$" and "%" are ignored. Returns null for anything else (mixed numbers,
 * units, letters, division by zero).
 */
export function parseNumericAnswer(raw: string): number | null {
  const s = raw.replace(/[\s,$%]/g, '');
  if (!s) return null;
  const slash = s.indexOf('/');
  if (slash !== -1) {
    const numerator = s.slice(0, slash);
    const denominator = s.slice(slash + 1);
    if (!NUMBER_RE.test(numerator) || !NUMBER_RE.test(denominator)) return null;
    const d = Number(denominator);
    if (d === 0) return null;
    return Number(numerator) / d;
  }
  if (!NUMBER_RE.test(s)) return null;
  return Number(s);
}

const EPSILON = 1e-9;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Digits after the decimal point of a plain decimal string, or -1 if it is not one. */
function decimalPlaces(s: string): number {
  const m = s.replace(/[\s,]/g, '').match(/^[+-]?\d*\.(\d+)$/);
  return m ? m[1].length : -1;
}

/**
 * Does a typed grid-in answer match one accepted value?
 *
 * Equivalent forms count: 0.5, .5 and 1/2 are the same answer. For a
 * non-terminating correct value the SAT accepts a decimal truncated or
 * rounded to fill the grid, so 2/3 accepts .666, .667, .6666 and .6667 but
 * not .66 (at least three decimal places are required).
 */
export function gridInMatches(studentAnswer: string, accepted: string): boolean {
  const s = studentAnswer.trim();
  const a = accepted.trim();
  if (!s || !a) return false;
  if (s.toLowerCase() === a.toLowerCase()) return true;

  const studentValue = parseNumericAnswer(s);
  const acceptedValue = parseNumericAnswer(a);
  if (studentValue === null || acceptedValue === null) return false;
  if (nearlyEqual(studentValue, acceptedValue)) return true;

  const places = decimalPlaces(s);
  if (places >= 3) {
    const scale = 10 ** places;
    const rounded = Math.round(acceptedValue * scale) / scale;
    // Only a value that does not terminate within `places` digits gets the
    // truncation/rounding allowance; .299 must never pass for .3.
    if (!nearlyEqual(acceptedValue, rounded)) {
      const truncated = Math.trunc(acceptedValue * scale + EPSILON) / scale;
      if (nearlyEqual(studentValue, truncated) || nearlyEqual(studentValue, rounded)) return true;
    }
  }
  return false;
}

/**
 * Grade an answer against a question of either format. A missing, blank or
 * "SKIP" answer is never correct.
 */
export function isAnswerCorrect(
  question: GradeSource,
  studentAnswer: string | null | undefined
): boolean {
  if (typeof studentAnswer !== 'string') return false;
  const s = studentAnswer.trim();
  if (!s || s.toUpperCase() === 'SKIP') return false;
  if (isStudentProduced(question)) {
    return acceptedAnswers(question.correct_answer).some((a) => gridInMatches(s, a));
  }
  return s.toUpperCase() === question.correct_answer.trim().toUpperCase();
}
