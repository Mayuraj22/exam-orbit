import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { Exam } from '../../../shared/models/exam.model';
import { Question } from '../../../shared/models/question.model';
import { Result } from '../../../shared/models/result.model';
import { Candidate } from '../../../shared/models/candidate.model';

/**
 * Status shared by every entity slice.
 * - `loading`: the list itself is being fetched (show a loader instead of the list).
 * - `saving`: a create/update/delete is in flight (keep the list, disable buttons).
 * - `error`: message from the last failed request, whichever kind it was.
 */
export interface RequestStatus {
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export interface ExamsState extends EntityState<Exam>, RequestStatus {}
export interface QuestionsState extends EntityState<Question>, RequestStatus {}
export interface ResultsState extends EntityState<Result>, RequestStatus {}
export interface CandidatesState extends EntityState<Candidate>, RequestStatus {}

export interface AdminExamsState {
  exams: ExamsState;
  questions: QuestionsState;
  results: ResultsState;
  candidates: CandidatesState;
  selectedExamId: string | null;
}

export const examsAdapter = createEntityAdapter<Exam>({
  sortComparer: (a, b) => b.created_at.localeCompare(a.created_at),
});

export const questionsAdapter = createEntityAdapter<Question>({
  sortComparer: (a, b) => a.order_index - b.order_index,
});

export const resultsAdapter = createEntityAdapter<Result>({
  sortComparer: (a, b) => b.submitted_at.localeCompare(a.submitted_at),
});

export const candidatesAdapter = createEntityAdapter<Candidate>({
  sortComparer: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
});

const initialStatus: RequestStatus = { loading: false, saving: false, error: null };

export const initialAdminExamsState: AdminExamsState = {
  exams: examsAdapter.getInitialState(initialStatus),
  questions: questionsAdapter.getInitialState(initialStatus),
  results: resultsAdapter.getInitialState(initialStatus),
  candidates: candidatesAdapter.getInitialState(initialStatus),
  selectedExamId: null,
};
