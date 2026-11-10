import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, mergeMap, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AdminExamsActions as A } from './exams.actions';
import { SupabaseService } from '../../../core/services/supabase';

/**
 * Operator choice:
 * - switchMap  for reads: a newer load makes the older one irrelevant.
 * - concatMap  for creates/updates: run in order, never drop a write.
 * - mergeMap   for deletes: independent of each other, safe to run in parallel.
 */

const toMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : ((error as { message?: string })?.message ?? 'Something went wrong');

export const loadExams$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.loadExams),
      switchMap(() =>
        api.getExams().pipe(
          map((exams) => A.loadExamsSuccess({ exams })),
          catchError((e) => of(A.loadExamsFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const createExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.createExam),
      concatMap(({ exam }) =>
        api.createExam(exam).pipe(
          map((created) => A.createExamSuccess({ exam: created })),
          catchError((e) => of(A.createExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const updateExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.updateExam),
      concatMap(({ id, changes }) =>
        api.updateExam(id, changes).pipe(
          map((exam) => A.updateExamSuccess({ exam })),
          catchError((e) => of(A.updateExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const deleteExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.deleteExam),
      mergeMap(({ id }) =>
        api.deleteExam(id).pipe(
          map(() => A.deleteExamSuccess({ id })),
          catchError((e) => of(A.deleteExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const publishExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.publishExam),
      concatMap(({ id }) =>
        api.publishExam(id).pipe(
          map((exam) => A.publishExamSuccess({ exam })),
          catchError((e) => of(A.publishExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const unpublishExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.unpublishExam),
      concatMap(({ id }) =>
        api.unpublishExam(id).pipe(
          map((exam) => A.unpublishExamSuccess({ exam })),
          catchError((e) => of(A.unpublishExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const duplicateExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.duplicateExam),
      concatMap(({ id }) =>
        api.duplicateExam(id).pipe(
          map((exam) => A.duplicateExamSuccess({ exam })),
          catchError((e) => of(A.duplicateExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

/** If saving a new order fails, reload so the list matches the database again. */
export const reorderQuestions$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.reorderQuestions),
      concatMap(({ examId, orderedIds }) =>
        api.reorderQuestions(orderedIds).pipe(
          map(() => A.reorderQuestionsSuccess()),
          catchError((e) =>
            of(
              A.reorderQuestionsFailure({ examId, error: toMessage(e) }),
              A.loadQuestions({ examId }),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadQuestions$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.loadQuestions),
      switchMap(({ examId }) =>
        api.getQuestionsByExamId(examId).pipe(
          map((questions) => A.loadQuestionsSuccess({ questions })),
          catchError((e) => of(A.loadQuestionsFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const createQuestion$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.createQuestion),
      concatMap(({ question }) =>
        api.createQuestion(question).pipe(
          map((created) => A.createQuestionSuccess({ question: created })),
          catchError((e) => of(A.createQuestionFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const updateQuestion$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.updateQuestion),
      concatMap(({ id, changes }) =>
        api.updateQuestion(id, changes).pipe(
          map((question) => A.updateQuestionSuccess({ question })),
          catchError((e) => of(A.updateQuestionFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const deleteQuestion$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.deleteQuestion),
      mergeMap(({ id }) =>
        api.deleteQuestion(id).pipe(
          map(() => A.deleteQuestionSuccess({ id })),
          catchError((e) => of(A.deleteQuestionFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const loadCandidates$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.loadCandidates),
      switchMap(({ examId }) =>
        (examId ? api.getCandidatesByExamId(examId) : api.getAllCandidates()).pipe(
          map((candidates) => A.loadCandidatesSuccess({ candidates })),
          catchError((e) => of(A.loadCandidatesFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const createCandidates$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.createCandidates),
      concatMap(({ candidates }) =>
        api.createCandidates(candidates).pipe(
          map((created) => A.createCandidatesSuccess({ candidates: created })),
          catchError((e) => of(A.createCandidatesFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const deleteCandidate$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.deleteCandidate),
      mergeMap(({ id }) =>
        api.deleteCandidate(id).pipe(
          map(() => A.deleteCandidateSuccess({ id })),
          catchError((e) => of(A.deleteCandidateFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const resetCandidateAttempt$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.resetCandidateAttempt),
      concatMap(({ id }) =>
        api.updateCandidate(id, { has_attempted: false }).pipe(
          map((candidate) => A.resetCandidateAttemptSuccess({ candidate })),
          catchError((e) => of(A.resetCandidateAttemptFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const loadAllResults$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.loadAllResults),
      switchMap(() =>
        api.getAllResults().pipe(
          map((results) => A.loadResultsForExamSuccess({ results })),
          catchError((e) => of(A.loadResultsForExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const loadResultsForExam$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.loadResultsForExam),
      switchMap(({ examId }) =>
        api.getResultsByExamId(examId).pipe(
          map((results) => A.loadResultsForExamSuccess({ results })),
          catchError((e) => of(A.loadResultsForExamFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const submitGrading$ = createEffect(
  (actions$ = inject(Actions), api = inject(SupabaseService)) =>
    actions$.pipe(
      ofType(A.submitGrading),
      concatMap(({ resultId, gradedAnswers, newScore, isFullyGraded }) =>
        api.updateResultGrading(resultId, gradedAnswers, newScore, isFullyGraded).pipe(
          map((result) => A.submitGradingSuccess({ result })),
          catchError((e) => of(A.submitGradingFailure({ error: toMessage(e) }))),
        ),
      ),
    ),
  { functional: true },
);

export const adminExamsEffects = {
  loadExams$,
  createExam$,
  updateExam$,
  deleteExam$,
  publishExam$,
  unpublishExam$,
  duplicateExam$,
  reorderQuestions$,
  loadQuestions$,
  createQuestion$,
  updateQuestion$,
  deleteQuestion$,
  loadCandidates$,
  createCandidates$,
  deleteCandidate$,
  resetCandidateAttempt$,
  loadAllResults$,
  loadResultsForExam$,
  submitGrading$,
};
