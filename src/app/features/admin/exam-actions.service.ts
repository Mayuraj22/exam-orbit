import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { filter, Observable, shareReplay, tap } from 'rxjs';
import { AdminExamsActions } from './store/exams.actions';
import { Exam } from '../../shared/models/exam.model';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm.service';
import {
  ExamDialogComponent,
  ExamDialogData,
} from './components/exam-dialog/exam-dialog.component';

/**
 * Exam actions shared by the exam list and the exam detail page:
 * opens the right dialog/confirmation, then dispatches the store action.
 * Keeps both pages consistent and their components small.
 */
@Injectable({ providedIn: 'root' })
export class ExamActionsService {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);

  /** Opens the create (no exam) or edit dialog. Emits the saved exam, or undefined if cancelled. */
  openEditor(exam?: Exam): Observable<Exam | undefined> {
    return this.dialog
      .open<ExamDialogComponent, ExamDialogData, Exam>(ExamDialogComponent, {
        data: { exam },
        width: '560px',
        maxWidth: '94vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed();
  }

  publish(exam: Exam): void {
    this.confirm
      .ask({
        title: 'Publish exam?',
        message: `"${exam.title}" will become available to candidates.`,
        confirmText: 'Publish',
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.store.dispatch(AdminExamsActions.publishExam({ id: exam.id })));
  }

  unpublish(exam: Exam): void {
    this.confirm
      .ask({
        title: 'Move back to draft?',
        message: `Candidates will no longer be able to start "${exam.title}". Anyone already taking it is not affected.`,
        confirmText: 'Unpublish',
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.store.dispatch(AdminExamsActions.unpublishExam({ id: exam.id })));
  }

  duplicate(exam: Exam): void {
    this.store.dispatch(AdminExamsActions.duplicateExam({ id: exam.id }));
  }

  /**
   * Asks, then dispatches the delete. Returns an observable that emits true once
   * confirmed, so a caller can react (e.g. navigate away). The dialog opens once
   * whether or not the caller subscribes (shareReplay + an internal subscription).
   */
  delete(exam: Exam): Observable<boolean> {
    const confirmed$ = this.confirm
      .ask({
        title: 'Delete exam?',
        message: `"${exam.title}" and its questions will be permanently deleted. This can't be undone.`,
        confirmText: 'Delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        tap(() => this.store.dispatch(AdminExamsActions.deleteExam({ id: exam.id }))),
        shareReplay(1),
      );
    confirmed$.subscribe();
    return confirmed$;
  }
}
