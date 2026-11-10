import { AdminExamsActions as A } from './exams.actions';
import { adminExamsFeature } from './exams.reducer';
import { initialAdminExamsState } from './exams.state';
import { Exam } from '../../../shared/models/exam.model';
import { Question } from '../../../shared/models/question.model';
import { Candidate } from '../../../shared/models/candidate.model';

const reducer = adminExamsFeature.reducer;

const exam = (id: string, created_at = '2026-01-01'): Exam => ({
  id,
  title: `Exam ${id}`,
  description: null,
  duration_minutes: 30,
  is_published: false,
  created_at,
});

const question = (id: string, order_index: number): Question => ({
  id,
  exam_id: 'e1',
  question_text: id,
  question_type: 'input',
  options: null,
  correct_answer: 'x',
  order_index,
});

describe('adminExams reducer', () => {
  it('uses "loading" for fetches and "saving" for writes', () => {
    const loading = reducer(initialAdminExamsState, A.loadExams());
    expect(loading.exams.loading).toBe(true);
    expect(loading.exams.saving).toBe(false);

    const saving = reducer(initialAdminExamsState, A.deleteExam({ id: 'e1' }));
    expect(saving.exams.saving).toBe(true);
    expect(saving.exams.loading).toBe(false);
  });

  it('keeps the list while saving and records failures', () => {
    let state = reducer(initialAdminExamsState, A.loadExamsSuccess({ exams: [exam('e1')] }));
    state = reducer(state, A.publishExam({ id: 'e1' }));
    expect(state.exams.ids).toEqual(['e1']);

    state = reducer(state, A.publishExamFailure({ error: 'boom' }));
    expect(state.exams.saving).toBe(false);
    expect(state.exams.error).toBe('boom');
  });

  it('sorts exams newest first', () => {
    const state = reducer(
      initialAdminExamsState,
      A.loadExamsSuccess({ exams: [exam('old', '2026-01-01'), exam('new', '2026-02-01')] }),
    );
    expect(state.exams.ids).toEqual(['new', 'old']);
  });

  it('clears the selection when the selected exam is deleted', () => {
    let state = reducer(initialAdminExamsState, A.loadExamsSuccess({ exams: [exam('e1')] }));
    state = reducer(state, A.selectExam({ examId: 'e1' }));
    state = reducer(state, A.deleteExamSuccess({ id: 'e1' }));
    expect(state.selectedExamId).toBeNull();
    expect(state.exams.ids).toEqual([]);
  });

  it('reorders questions optimistically', () => {
    let state = reducer(
      initialAdminExamsState,
      A.loadQuestionsSuccess({ questions: [question('a', 0), question('b', 1), question('c', 2)] }),
    );
    state = reducer(state, A.reorderQuestions({ examId: 'e1', orderedIds: ['c', 'a', 'b'] }));
    expect(state.questions.ids).toEqual(['c', 'a', 'b']);
    expect(state.questions.entities['c']?.order_index).toBe(0);
  });

  it('adds many candidates at once (CSV import)', () => {
    const candidates: Candidate[] = ['Bea', 'Al'].map((name, i) => ({
      id: `c${i}`,
      exam_id: 'e1',
      name,
      username: name.toLowerCase(),
      passcode: 'ABCDEF',
      has_attempted: false,
    }));
    const state = reducer(initialAdminExamsState, A.createCandidatesSuccess({ candidates }));
    // Sorted by name.
    expect(state.candidates.ids).toEqual(['c1', 'c0']);
  });
});
