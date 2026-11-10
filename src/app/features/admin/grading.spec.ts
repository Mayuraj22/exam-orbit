import { correctOption, gradeResult, normalizeAnswer, scoreOf } from './grading';
import { Question } from '../../shared/models/question.model';
import { Result } from '../../shared/models/result.model';

const mcq = (correct: string): Question => ({
  id: 'q1',
  exam_id: 'e1',
  question_text: 'Value of pi?',
  question_type: 'mcq',
  options: [
    { id: 'o1', text: '3.12' },
    { id: 'o2', text: '3.14' },
  ],
  correct_answer: correct,
  order_index: 0,
});

const input = (correct: string): Question => ({
  id: 'q2',
  exam_id: 'e1',
  question_text: 'Capital of France?',
  question_type: 'input',
  options: null,
  correct_answer: correct,
  order_index: 1,
});

const result = (
  answers: Record<string, string>,
  graded: Record<string, boolean> | null = null,
): Result => ({
  id: 'r1',
  candidate_id: 'c1',
  exam_id: 'e1',
  answers,
  score: null,
  submitted_at: '2026-01-01T00:00:00Z',
  graded_answers: graded,
  is_fully_graded: false,
});

describe('grading', () => {
  describe('MCQ', () => {
    it('marks the correct option id as correct', () => {
      const [a] = gradeResult(result({ q1: 'o2' }), [mcq('o2')]);
      expect(a.correct).toBe(true);
      expect(a.source).toBe('auto');
      expect(a.answerText).toBe('3.14');
    });

    // Regression: older questions stored the option *text* as the correct answer,
    // while candidates' answers are option ids. This used to score 0.
    it('handles legacy questions that store the correct option text', () => {
      const [a] = gradeResult(result({ q1: 'o2' }), [mcq('3.14')]);
      expect(a.correct).toBe(true);
      expect(correctOption(mcq('3.14'))?.id).toBe('o2');
    });

    it('marks a different option as wrong', () => {
      expect(gradeResult(result({ q1: 'o1' }), [mcq('o2')])[0].correct).toBe(false);
    });

    it('marks an unanswered question as wrong', () => {
      expect(gradeResult(result({}), [mcq('o2')])[0].correct).toBe(false);
    });
  });

  describe('Input', () => {
    it('suggests correct for an exact match, ignoring case and spaces', () => {
      const [a] = gradeResult(result({ q2: '  PARIS ' }), [input('Paris')]);
      expect(a.correct).toBe(true);
      expect(a.source).toBe('suggested');
    });

    it('leaves a non-matching answer for the admin to decide', () => {
      const [a] = gradeResult(result({ q2: 'Paris, France' }), [input('Paris')]);
      expect(a.correct).toBeNull();
      expect(a.source).toBe('none');
    });

    it("uses the admin's saved mark over any suggestion", () => {
      const [a] = gradeResult(result({ q2: 'Paris' }, { q2: false }), [input('Paris')]);
      expect(a.correct).toBe(false);
      expect(a.source).toBe('manual');
    });

    it('marks an empty answer as wrong', () => {
      expect(gradeResult(result({ q2: '   ' }), [input('Paris')])[0].correct).toBe(false);
    });
  });

  it('normalizes answers', () => {
    expect(normalizeAnswer('  New   York ')).toBe('new york');
  });

  it('computes score percentages', () => {
    expect(scoreOf(3, 4)).toEqual({ score: 3, total: 4, percent: 75 });
    expect(scoreOf(null, 0)).toEqual({ score: 0, total: 0, percent: null });
  });
});
