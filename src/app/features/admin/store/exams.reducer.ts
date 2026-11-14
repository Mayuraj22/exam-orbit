import { createFeature, createReducer, on } from '@ngrx/store';
import { AdminExamsActions as A } from './exams.actions';
import {
  candidatesAdapter,
  examsAdapter,
  initialAdminExamsState,
  questionsAdapter,
  RequestStatus,
  resultsAdapter,
} from './exams.state';

// Small helpers so each `on(...)` reads as "what changes", not boilerplate.
const fetching = <S extends RequestStatus>(s: S): S => ({ ...s, loading: true, error: null });
const saving = <S extends RequestStatus>(s: S): S => ({ ...s, saving: true, error: null });
const done = <S extends RequestStatus>(s: S): S => ({
  ...s,
  loading: false,
  saving: false,
  error: null,
});
const failed = <S extends RequestStatus>(s: S, error: string): S => ({
  ...s,
  loading: false,
  saving: false,
  error,
});

const adminExamsReducer = createReducer(
  initialAdminExamsState,

  on(A.selectExam, (state, { examId }) => ({ ...state, selectedExamId: examId })),

  // Exams
  on(A.loadExams, (state) => ({ ...state, exams: fetching(state.exams) })),
  on(
    A.createExam,
    A.updateExam,
    A.deleteExam,
    A.publishExam,
    A.unpublishExam,
    A.duplicateExam,
    (state) => ({
      ...state,
      exams: saving(state.exams),
    }),
  ),
  on(A.loadExamsSuccess, (state, { exams }) => ({
    ...state,
    exams: examsAdapter.setAll(exams, done(state.exams)),
  })),
  on(A.createExamSuccess, A.duplicateExamSuccess, (state, { exam }) => ({
    ...state,
    exams: examsAdapter.addOne(exam, done(state.exams)),
  })),
  on(A.updateExamSuccess, A.publishExamSuccess, A.unpublishExamSuccess, (state, { exam }) => ({
    ...state,
    exams: examsAdapter.upsertOne(exam, done(state.exams)),
  })),
  on(A.deleteExamSuccess, (state, { id }) => ({
    ...state,
    exams: examsAdapter.removeOne(id, done(state.exams)),
    selectedExamId: state.selectedExamId === id ? null : state.selectedExamId,
  })),
  on(
    A.loadExamsFailure,
    A.createExamFailure,
    A.updateExamFailure,
    A.deleteExamFailure,
    A.publishExamFailure,
    A.unpublishExamFailure,
    A.duplicateExamFailure,
    (state, { error }) => ({ ...state, exams: failed(state.exams, error) }),
  ),

  // Questions
  on(A.loadQuestions, (state) => ({ ...state, questions: fetching(state.questions) })),
  on(A.createQuestion, A.updateQuestion, A.deleteQuestion, (state) => ({
    ...state,
    questions: saving(state.questions),
  })),
  on(A.loadQuestionsSuccess, (state, { questions }) => ({
    ...state,
    questions: questionsAdapter.setAll(questions, done(state.questions)),
  })),
  on(A.createQuestionSuccess, A.updateQuestionSuccess, (state, { question }) => ({
    ...state,
    questions: questionsAdapter.upsertOne(question, done(state.questions)),
  })),
  on(A.deleteQuestionSuccess, (state, { id }) => ({
    ...state,
    questions: questionsAdapter.removeOne(id, done(state.questions)),
  })),
  // Optimistic: move the questions right away so the drag-drop feels instant.
  on(A.reorderQuestions, (state, { orderedIds }) => ({
    ...state,
    questions: questionsAdapter.updateMany(
      orderedIds.map((id, index) => ({ id, changes: { order_index: index } })),
      saving(state.questions),
    ),
  })),
  on(A.reorderQuestionsSuccess, (state) => ({ ...state, questions: done(state.questions) })),
  on(
    A.reorderQuestionsFailure,
    A.loadQuestionsFailure,
    A.createQuestionFailure,
    A.updateQuestionFailure,
    A.deleteQuestionFailure,
    (state, { error }) => ({ ...state, questions: failed(state.questions, error) }),
  ),

  // Candidates
  on(A.loadCandidates, (state) => ({ ...state, candidates: fetching(state.candidates) })),
  on(
    A.createCandidates,
    A.deleteCandidate,
    A.resetCandidateAttempt,
    A.resetCandidatePasscode,
    (state) => ({
      ...state,
      candidates: saving(state.candidates),
    }),
  ),
  on(A.loadCandidatesSuccess, (state, { candidates }) => ({
    ...state,
    candidates: candidatesAdapter.setAll(candidates, done(state.candidates)),
  })),
  on(A.createCandidatesSuccess, (state, { candidates }) => ({
    ...state,
    candidates: candidatesAdapter.addMany(candidates, done(state.candidates)),
  })),
  on(A.resetCandidateAttemptSuccess, A.resetCandidatePasscodeSuccess, (state, { candidate }) => ({
    ...state,
    candidates: candidatesAdapter.upsertOne(candidate, done(state.candidates)),
  })),
  on(A.deleteCandidateSuccess, (state, { id }) => ({
    ...state,
    candidates: candidatesAdapter.removeOne(id, done(state.candidates)),
  })),
  on(
    A.loadCandidatesFailure,
    A.createCandidatesFailure,
    A.deleteCandidateFailure,
    A.resetCandidateAttemptFailure,
    A.resetCandidatePasscodeFailure,
    (state, { error }) => ({ ...state, candidates: failed(state.candidates, error) }),
  ),

  // Results
  on(A.loadResultsForExam, A.loadAllResults, (state) => ({
    ...state,
    results: fetching(state.results),
  })),
  on(A.submitGrading, (state) => ({ ...state, results: saving(state.results) })),
  on(A.loadResultsForExamSuccess, (state, { results }) => ({
    ...state,
    results: resultsAdapter.setAll(results, done(state.results)),
  })),
  on(A.submitGradingSuccess, (state, { result }) => ({
    ...state,
    results: resultsAdapter.upsertOne(result, done(state.results)),
  })),
  on(A.loadResultsForExamFailure, A.submitGradingFailure, (state, { error }) => ({
    ...state,
    results: failed(state.results, error),
  })),
);

export const adminExamsFeature = createFeature({
  name: 'adminExams',
  reducer: adminExamsReducer,
});
