import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';
import { AdminExamsActions as A } from './exams.actions';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Shows a toast for every save result in one place, so components
 * never have to call the snackbar themselves.
 * `dispatch: false` because these effects only cause a side effect.
 */

const successMessages = [
  [A.createExamSuccess, 'Exam created'],
  [A.updateExamSuccess, 'Exam updated'],
  [A.deleteExamSuccess, 'Exam deleted'],
  [A.publishExamSuccess, 'Exam published'],
  [A.unpublishExamSuccess, 'Exam moved back to draft'],
  [A.duplicateExamSuccess, 'Exam duplicated'],
  [A.reorderQuestionsSuccess, 'Question order saved'],
  [A.createQuestionSuccess, 'Question added'],
  [A.updateQuestionSuccess, 'Question updated'],
  [A.deleteQuestionSuccess, 'Question deleted'],
  [A.submitGradingSuccess, 'Grading saved'],
  [A.saveReviewSuccess, 'Review decision saved'],
  [A.deleteCandidateSuccess, 'Candidate removed'],
  [A.resetCandidateAttemptSuccess, 'Attempt reset: the candidate can take the exam again'],
] as const;

const failureMessages = [
  [A.createExamFailure, "Couldn't create the exam"],
  [A.updateExamFailure, "Couldn't update the exam"],
  [A.deleteExamFailure, "Couldn't delete the exam"],
  [A.publishExamFailure, "Couldn't publish the exam"],
  [A.unpublishExamFailure, "Couldn't unpublish the exam"],
  [A.duplicateExamFailure, "Couldn't duplicate the exam"],
  [A.reorderQuestionsFailure, "Couldn't save the new order"],
  [A.createQuestionFailure, "Couldn't add the question"],
  [A.updateQuestionFailure, "Couldn't update the question"],
  [A.deleteQuestionFailure, "Couldn't delete the question"],
  [A.submitGradingFailure, "Couldn't save grading"],
  [A.saveReviewFailure, "Couldn't save the review decision"],
  [A.createCandidatesFailure, "Couldn't add candidates"],
  [A.deleteCandidateFailure, "Couldn't remove the candidate"],
  [A.resetCandidateAttemptFailure, "Couldn't reset the attempt"],
  [A.resetCandidatePasscodeFailure, "Couldn't reset the passcode"],
] as const;

const successByType = new Map<string, string>(
  successMessages.map(([action, msg]) => [action.type, msg]),
);
const failureByType = new Map<string, string>(
  failureMessages.map(([action, msg]) => [action.type, msg]),
);

export const saveSuccessToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(...successMessages.map(([action]) => action)),
      tap((action) => notify.success(successByType.get(action.type)!)),
    ),
  { functional: true, dispatch: false },
);

export const saveFailureToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(...failureMessages.map(([action]) => action)),
      tap((action) => notify.error(`${failureByType.get(action.type)!}: ${action.error}`)),
    ),
  { functional: true, dispatch: false },
);

/** Count-aware message for adding one or many candidates. */
export const candidatesAddedToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(A.createCandidatesSuccess),
      tap(({ candidates }) =>
        notify.success(
          candidates.length === 1 ? 'Candidate added' : `${candidates.length} candidates added`,
        ),
      ),
    ),
  { functional: true, dispatch: false },
);

export const adminNotificationEffects = {
  saveSuccessToast$,
  saveFailureToast$,
  candidatesAddedToast$,
};
