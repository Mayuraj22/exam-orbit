import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AdminExamsActions } from './exams.actions';
import { SupabaseService } from '../../../core/services/supabase';

export const loadExams$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.loadExams),
    switchMap(() =>
      supabaseService.getExams().pipe(
        map((exams) => AdminExamsActions.loadExamsSuccess({ exams })),
        catchError((error) => of(AdminExamsActions.loadExamsFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const createExam$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.createExam),
    switchMap(({ exam }) =>
      supabaseService.createExam(exam).pipe(
        map((exam) => AdminExamsActions.createExamSuccess({ exam })),
        catchError((error) => of(AdminExamsActions.createExamFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const updateExam$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.updateExam),
    switchMap(({ id, changes }) =>
      supabaseService.updateExam(id, changes).pipe(
        map((exam) => AdminExamsActions.updateExamSuccess({ exam })),
        catchError((error) => of(AdminExamsActions.updateExamFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const deleteExam$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.deleteExam),
    mergeMap(({ id }) =>
      supabaseService.deleteExam(id).pipe(
        map(() => AdminExamsActions.deleteExamSuccess({ id })),
        catchError((error) => of(AdminExamsActions.deleteExamFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const publishExam$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.publishExam),
    switchMap(({ id }) =>
      supabaseService.publishExam(id).pipe(
        map((exam) => AdminExamsActions.publishExamSuccess({ exam })),
        catchError((error) => of(AdminExamsActions.publishExamFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const loadQuestions$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.loadQuestions),
    switchMap(({ examId }) =>
      supabaseService.getQuestionsByExamId(examId).pipe(
        map((questions) => AdminExamsActions.loadQuestionsSuccess({ questions })),
        catchError((error) => of(AdminExamsActions.loadQuestionsFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const createQuestion$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.createQuestion),
    switchMap(({ question }) =>
      supabaseService.createQuestion(question).pipe(
        map((question) => AdminExamsActions.createQuestionSuccess({ question })),
        catchError((error) => of(AdminExamsActions.createQuestionFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const updateQuestion$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.updateQuestion),
    switchMap(({ id, changes }) =>
      supabaseService.updateQuestion(id, changes).pipe(
        map((question) => AdminExamsActions.updateQuestionSuccess({ question })),
        catchError((error) => of(AdminExamsActions.updateQuestionFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const deleteQuestion$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.deleteQuestion),
    mergeMap(({ id }) =>
      supabaseService.deleteQuestion(id).pipe(
        map(() => AdminExamsActions.deleteQuestionSuccess({ id })),
        catchError((error) => of(AdminExamsActions.deleteQuestionFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const loadResultsForExam$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.loadResultsForExam),
    switchMap(({ examId }) =>
      supabaseService.getResultsByExamId(examId).pipe(
        map((results) => AdminExamsActions.loadResultsForExamSuccess({ results })),
        catchError((error) => of(AdminExamsActions.loadResultsForExamFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const submitGrading$ = createEffect(() => {
  const actions$ = inject(Actions);
  const supabaseService = inject(SupabaseService);

  return actions$.pipe(
    ofType(AdminExamsActions.submitGrading),
    switchMap(({ resultId, gradedAnswers, newScore, isFullyGraded }) =>
      supabaseService.updateResultGrading(resultId, gradedAnswers, newScore, isFullyGraded).pipe(
        map((result) => AdminExamsActions.submitGradingSuccess({ result })),
        catchError((error) => of(AdminExamsActions.submitGradingFailure({ error: error.message })))
      )
    )
  );
}, { functional: true });

export const adminExamsEffects = {
  loadExams$,
  createExam$,
  updateExam$,
  deleteExam$,
  publishExam$,
  loadQuestions$,
  createQuestion$,
  updateQuestion$,
  deleteQuestion$,
  loadResultsForExam$,
  submitGrading$,
};
