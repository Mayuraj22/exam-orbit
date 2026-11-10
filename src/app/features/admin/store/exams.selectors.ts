import { createSelector } from '@ngrx/store';
import { adminExamsFeature } from './exams.reducer';
import { candidatesAdapter, examsAdapter, questionsAdapter, resultsAdapter } from './exams.state';

const examSel = examsAdapter.getSelectors();
const questionSel = questionsAdapter.getSelectors();
const resultSel = resultsAdapter.getSelectors();

const {
  selectExams: examsSlice,
  selectQuestions: questionsSlice,
  selectResults: resultsSlice,
} = adminExamsFeature;

// Exams
export const selectExams = createSelector(examsSlice, examSel.selectAll);
export const selectExamDictionary = createSelector(examsSlice, examSel.selectEntities);
export const selectExamsLoading = createSelector(examsSlice, (s) => s.loading);
export const selectExamsSaving = createSelector(examsSlice, (s) => s.saving);
export const selectExamsError = createSelector(examsSlice, (s) => s.error);

export const selectSelectedExamId = adminExamsFeature.selectSelectedExamId;
export const selectSelectedExam = createSelector(
  selectSelectedExamId,
  selectExamDictionary,
  (id, dict) => (id ? (dict[id] ?? null) : null),
);

/** One exam by id (null while not loaded). */
export const selectExamById = (id: string) =>
  createSelector(selectExamDictionary, (dict) => dict[id] ?? null);

// Questions
export const selectQuestions = createSelector(questionsSlice, questionSel.selectAll);
export const selectQuestionDictionary = createSelector(questionsSlice, questionSel.selectEntities);
export const selectQuestionsLoading = createSelector(questionsSlice, (s) => s.loading);
export const selectQuestionsSaving = createSelector(questionsSlice, (s) => s.saving);
export const selectQuestionsError = createSelector(questionsSlice, (s) => s.error);

/** Questions of one exam, already sorted by order_index via the adapter. */
export const selectQuestionsByExamId = (examId: string) =>
  createSelector(selectQuestions, (questions) => questions.filter((q) => q.exam_id === examId));

// Candidates
const candidateSel = candidatesAdapter.getSelectors();
const candidatesSlice = adminExamsFeature.selectCandidates;
export const selectCandidates = createSelector(candidatesSlice, candidateSel.selectAll);
export const selectCandidateDictionary = createSelector(
  candidatesSlice,
  candidateSel.selectEntities,
);
export const selectCandidatesLoading = createSelector(candidatesSlice, (s) => s.loading);
export const selectCandidatesSaving = createSelector(candidatesSlice, (s) => s.saving);
export const selectCandidatesError = createSelector(candidatesSlice, (s) => s.error);

// Results
export const selectResults = createSelector(resultsSlice, resultSel.selectAll);
export const selectResultDictionary = createSelector(resultsSlice, resultSel.selectEntities);
export const selectResultsLoading = createSelector(resultsSlice, (s) => s.loading);
export const selectResultsSaving = createSelector(resultsSlice, (s) => s.saving);
export const selectResultsError = createSelector(resultsSlice, (s) => s.error);
