import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import { selectExamsSaving } from '../../store/exams.selectors';
import { Exam } from '../../../../shared/models/exam.model';
import { ExamFormComponent, ExamFormValue } from '../exam-form/exam-form.component';

export interface ExamDialogData {
  /** Pass an exam to edit it; omit to create a new one. */
  exam?: Exam;
}

/**
 * Create / edit exam dialog. Dispatches the store action itself and closes
 * only when the save succeeds (returning the saved exam), so a failure keeps the dialog open.
 */
@Component({
  selector: 'app-exam-dialog',
  imports: [MatDialogModule, ExamFormComponent],
  template: `
    <h2 mat-dialog-title>{{ data.exam ? 'Edit exam' : 'Create exam' }}</h2>
    <mat-dialog-content>
      <app-exam-form
        [exam]="data.exam ?? null"
        [saving]="saving()"
        [submitLabel]="data.exam ? 'Save changes' : 'Create exam'"
        (submitted)="save($event)"
        (cancelled)="dialogRef.close()"
      />
    </mat-dialog-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamDialogComponent {
  protected readonly data = inject<ExamDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<ExamDialogComponent, Exam>>(MatDialogRef);
  private readonly store = inject(Store);
  protected readonly saving = this.store.selectSignal(selectExamsSaving);

  constructor() {
    inject(Actions)
      .pipe(
        ofType(AdminExamsActions.createExamSuccess, AdminExamsActions.updateExamSuccess),
        takeUntilDestroyed(),
      )
      .subscribe(({ exam }) => this.dialogRef.close(exam));
  }

  protected save(value: ExamFormValue): void {
    if (this.data.exam) {
      this.store.dispatch(AdminExamsActions.updateExam({ id: this.data.exam.id, changes: value }));
    } else {
      this.store.dispatch(
        AdminExamsActions.createExam({ exam: { ...value, is_published: false } }),
      );
    }
  }
}
