import { Question } from '../../shared/models/question.model';
import { Result } from '../../shared/models/result.model';

/** How one answer was marked. */
export type MarkSource = 'auto' | 'suggested' | 'manual' | 'none';

export interface GradedAnswer {
  question: Question;
  /** What the candidate submitted, made readable (option text for MCQ). */
  answerText: string | null;
  correctText: string | null;
  /** true/false once marked; null while an Input answer still needs a decision. */
  correct: boolean | null;
  source: MarkSource;
}

/** Lower-case, trim and collapse spaces, so "  Paris " matches "paris". */
export const normalizeAnswer = (text: string): string =>
  text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The correct option of an MCQ. New questions store the option id;
 * older rows stored the option text, so both are accepted.
 */
export function correctOption(question: Question) {
  return (
    question.options?.find(
      (o) => o.id === question.correct_answer || o.text === question.correct_answer,
    ) ?? null
  );
}

/**
 * Marks every question of a result:
 * - MCQ: always automatic (chosen option id vs correct option).
 * - Input: the admin's saved mark if any; otherwise an exact (normalized) match
 *   is *suggested* as correct, and anything else is left for the admin.
 */
export function gradeResult(result: Result, questions: readonly Question[]): GradedAnswer[] {
  return questions.map((question) => {
    const raw = result.answers?.[question.id] ?? null;
    const saved = result.graded_answers?.[question.id];

    if (question.question_type === 'mcq') {
      const correct = correctOption(question);
      const chosen = question.options?.find((o) => o.id === raw || o.text === raw) ?? null;
      return {
        question,
        answerText: chosen?.text ?? raw,
        correctText: correct?.text ?? null,
        correct: raw === null ? false : !!correct && chosen?.id === correct.id,
        source: 'auto',
      };
    }

    const correctText = question.correct_answer;
    if (saved !== undefined) {
      return { question, answerText: raw, correctText, correct: saved, source: 'manual' };
    }
    if (raw === null || raw.trim() === '') {
      return { question, answerText: null, correctText, correct: false, source: 'auto' };
    }
    if (correctText && normalizeAnswer(raw) === normalizeAnswer(correctText)) {
      return { question, answerText: raw, correctText, correct: true, source: 'suggested' };
    }
    return { question, answerText: raw, correctText, correct: null, source: 'none' };
  });
}

/** Score as a count and percentage (percentage is null when there are no questions). */
export function scoreOf(
  score: number | null,
  total: number,
): { score: number; total: number; percent: number | null } {
  const s = score ?? 0;
  return { score: s, total, percent: total > 0 ? Math.round((s / total) * 100) : null };
}

export type PassOutcome = 'pass' | 'fail';

/**
 * Pass/fail for a percentage against the exam's pass mark.
 * null when the exam has no pass mark or the percentage is unknown.
 */
export function passOutcome(percent: number | null, passMark: number | null): PassOutcome | null {
  if (passMark === null || passMark === undefined || percent === null) return null;
  return percent >= passMark ? 'pass' : 'fail';
}
