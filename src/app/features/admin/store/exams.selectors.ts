import { createSelector } from '@ngrx/store';
import { adminExamsFeature } from './exams.reducer';
import { examsAdapter, questionsAdapter } from './exams.state';

const { selectAll: selectAllExams, selectEntities: selectExamEntities } = examsAdapter.getSelectors();
const { selectAll: selectAllQuestions, selectEntities: selectQuestionEntities } = questionsAdapter.getSelectors();

export const selectExams = createSelector(adminExamsFeature.selectExams, selectAllExams);
export const selectExamDictionary = createSelector(adminExamsFeature.selectExams, selectExamEntities);
export const selectExamsLoading = createSelector(adminExamsFeature.selectExams, (state) => state.loading);
export const selectExamsError = createSelector(adminExamsFeature.selectExams, (state) => state.error);

export const selectQuestions = createSelector(adminExamsFeature.selectQuestions, selectAllQuestions);
export const selectQuestionDictionary = createSelector(adminExamsFeature.selectQuestions, selectQuestionEntities);
export const selectQuestionsLoading = createSelector(adminExamsFeature.selectQuestions, (state) => state.loading);
export const selectQuestionsError = createSelector(adminExamsFeature.selectQuestions, (state) => state.error);

export const selectSelectedExam = createSelector(
  adminExamsFeature.selectSelectedExamId,
  selectExamDictionary,
  (examId, examDictionary) => (examId ? examDictionary[examId] : null)
);
