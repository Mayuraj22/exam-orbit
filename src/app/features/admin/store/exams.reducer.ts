import { createFeature, createReducer, on } from '@ngrx/store';
import { AdminExamsActions } from './exams.actions';
import {
  initialAdminExamsState,
  examsAdapter,
  questionsAdapter,
  resultsAdapter,
} from './exams.state';

const adminExamsReducer = createReducer(
  initialAdminExamsState,
  on(AdminExamsActions.selectExam, (state, { examId }) => ({
    ...state,
    selectedExamId: examId,
  })),
  on(AdminExamsActions.loadExams, (state) => ({
    ...state,
    exams: { ...state.exams, loading: true, error: null },
  })),
  on(AdminExamsActions.loadExamsSuccess, (state, { exams }) => ({
    ...state,
    exams: examsAdapter.setAll(exams, { ...state.exams, loading: false, error: null }),
  })),
  on(AdminExamsActions.loadExamsFailure, (state, { error }) => ({
    ...state,
    exams: { ...state.exams, loading: false, error },
  })),
  on(AdminExamsActions.createExam, (state) => ({
    ...state,
    exams: { ...state.exams, loading: true, error: null },
  })),
  on(AdminExamsActions.createExamSuccess, (state, { exam }) => ({
    ...state,
    exams: examsAdapter.addOne(exam, { ...state.exams, loading: false, error: null }),
  })),
  on(AdminExamsActions.createExamFailure, (state, { error }) => ({
    ...state,
    exams: { ...state.exams, loading: false, error },
  })),
  on(AdminExamsActions.updateExam, (state) => ({
    ...state,
    exams: { ...state.exams, loading: true, error: null },
  })),
  on(AdminExamsActions.updateExamSuccess, (state, { exam }) => ({
    ...state,
    exams: examsAdapter.updateOne({ id: exam.id, changes: exam }, { ...state.exams, loading: false, error: null }),
  })),
  on(AdminExamsActions.updateExamFailure, (state, { error }) => ({
    ...state,
    exams: { ...state.exams, loading: false, error },
  })),
  on(AdminExamsActions.deleteExam, (state) => ({
    ...state,
    exams: { ...state.exams, loading: true, error: null },
  })),
  on(AdminExamsActions.deleteExamSuccess, (state, { id }) => ({
    ...state,
    exams: examsAdapter.removeOne(id, { ...state.exams, loading: false, error: null }),
  })),
  on(AdminExamsActions.deleteExamFailure, (state, { error }) => ({
    ...state,
    exams: { ...state.exams, loading: false, error },
  })),
  on(AdminExamsActions.publishExam, (state) => ({
    ...state,
    exams: { ...state.exams, loading: true, error: null },
  })),
  on(AdminExamsActions.publishExamSuccess, (state, { exam }) => ({
    ...state,
    exams: examsAdapter.updateOne({ id: exam.id, changes: exam }, { ...state.exams, loading: false, error: null }),
  })),
  on(AdminExamsActions.publishExamFailure, (state, { error }) => ({
    ...state,
    exams: { ...state.exams, loading: false, error },
  })),
  on(AdminExamsActions.loadQuestions, (state) => ({
    ...state,
    questions: { ...state.questions, loading: true, error: null },
  })),
  on(AdminExamsActions.loadQuestionsSuccess, (state, { questions }) => ({
    ...state,
    questions: questionsAdapter.setAll(questions, { ...state.questions, loading: false, error: null }),
  })),
  on(AdminExamsActions.loadQuestionsFailure, (state, { error }) => ({
    ...state,
    questions: { ...state.questions, loading: false, error },
  })),
  on(AdminExamsActions.createQuestion, (state) => ({
    ...state,
    questions: { ...state.questions, loading: true, error: null },
  })),
  on(AdminExamsActions.createQuestionSuccess, (state, { question }) => ({
    ...state,
    questions: questionsAdapter.addOne(question, { ...state.questions, loading: false, error: null }),
  })),
  on(AdminExamsActions.createQuestionFailure, (state, { error }) => ({
    ...state,
    questions: { ...state.questions, loading: false, error },
  })),
  on(AdminExamsActions.updateQuestion, (state) => ({
    ...state,
    questions: { ...state.questions, loading: true, error: null },
  })),
  on(AdminExamsActions.updateQuestionSuccess, (state, { question }) => ({
    ...state,
    questions: questionsAdapter.updateOne({ id: question.id, changes: question }, { ...state.questions, loading: false, error: null }),
  })),
  on(AdminExamsActions.updateQuestionFailure, (state, { error }) => ({
    ...state,
    questions: { ...state.questions, loading: false, error },
  })),
  on(AdminExamsActions.deleteQuestion, (state) => ({
    ...state,
    questions: { ...state.questions, loading: true, error: null },
  })),
  on(AdminExamsActions.deleteQuestionSuccess, (state, { id }) => ({
    ...state,
    questions: questionsAdapter.removeOne(id, { ...state.questions, loading: false, error: null }),
  })),
  on(AdminExamsActions.deleteQuestionFailure, (state, { error }) => ({
    ...state,
    questions: { ...state.questions, loading: false, error },
  })),
  on(AdminExamsActions.loadResultsForExam, (state) => ({
    ...state,
    results: { ...state.results, loading: true, error: null },
  })),
  on(AdminExamsActions.loadResultsForExamSuccess, (state, { results }) => ({
    ...state,
    results: resultsAdapter.setAll(results, { ...state.results, loading: false, error: null }),
  })),
  on(AdminExamsActions.loadResultsForExamFailure, (state, { error }) => ({
    ...state,
    results: { ...state.results, loading: false, error },
  })),
  on(AdminExamsActions.submitGrading, (state) => ({
    ...state,
    results: { ...state.results, loading: true, error: null },
  })),
  on(AdminExamsActions.submitGradingSuccess, (state, { result }) => ({
    ...state,
    results: resultsAdapter.updateOne({ id: result.id, changes: result }, { ...state.results, loading: false, error: null }),
  })),
  on(AdminExamsActions.submitGradingFailure, (state, { error }) => ({
    ...state,
    results: { ...state.results, loading: false, error },
  }))
);

export const adminExamsFeature = createFeature({
  name: 'adminExams',
  reducer: adminExamsReducer,
});
