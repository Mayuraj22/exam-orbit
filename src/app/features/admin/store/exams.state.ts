import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { Exam } from '../../../shared/models/exam.model';
import { Question } from '../../../shared/models/question.model';

export interface ExamsState extends EntityState<Exam> {
  loading: boolean;
  error: string | null;
}

export interface QuestionsState extends EntityState<Question> {
  loading: boolean;
  error: string | null;
}

export interface AdminExamsState {
  exams: ExamsState;
  questions: QuestionsState;
  selectedExamId: string | null;
}

export const examsAdapter = createEntityAdapter<Exam>({
  selectId: (exam: Exam) => exam.id,
  sortComparer: (a: Exam, b: Exam) => b.created_at.localeCompare(a.created_at),
});

export const questionsAdapter = createEntityAdapter<Question>({
  selectId: (question: Question) => question.id,
  sortComparer: (a: Question, b: Question) => a.order_index - b.order_index,
});

export const initialExamsState: ExamsState = examsAdapter.getInitialState({
  loading: false,
  error: null,
});

export const initialQuestionsState: QuestionsState = questionsAdapter.getInitialState({
  loading: false,
  error: null,
});

export const initialAdminExamsState: AdminExamsState = {
  exams: initialExamsState,
  questions: initialQuestionsState,
  selectedExamId: null,
};
