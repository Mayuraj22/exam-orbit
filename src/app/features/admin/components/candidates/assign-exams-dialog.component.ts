import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectCandidateDictionary,
  selectCandidatesSaving,
  selectExams,
} from '../../store/exams.selectors';

export interface AssignExamsDialogData {
  candidateIds: string[];
}

/** Assign one or more exams to the selected candidates. */
@Component({
  selector: 'app-assign-exams-dialog',
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>
      Assign {{ count() === 1 ? (firstName() ?? '1 candidate') : count() + ' candidates' }}
    </h2>
    <mat-dialog-content>
      @if (exams().length) {
        <p class="intro">Choose the exams they may take.</p>
        <ul class="exam-list">
          @for (exam of exams(); track exam.id) {
            <li>
              <mat-checkbox [checked]="chosen().has(exam.id)" (change)="toggle(exam.id)">
                {{ exam.title }}
                <span class="hint">
                  {{ exam.is_published ? 'Published' : 'Draft' }}
                  @if (alreadyAssigned()[exam.id]; as n) {
                    · {{ n === count() ? 'all' : n }} already assigned
                  }
                </span>
              </mat-checkbox>
            </li>
          }
        </ul>
        <p class="hint">Anyone already assigned to a chosen exam is left as they are.</p>
      } @else {
        <p>Create an exam first, then assign candidates to it.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        type="button"
        [disabled]="!chosen().size || saving()"
        (click)="assign()"
      >
        @if (saving()) {
          <mat-spinner diameter="18" />
        }
        Assign{{
          chosen().size ? ' to ' + chosen().size + ' exam' + (chosen().size === 1 ? '' : 's') : ''
        }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .intro {
      margin: 0 0 8px;
    }
    .exam-list {
      display: flex;
      flex-direction: column;
      max-height: 320px;
      margin: 0 0 8px;
      padding: 0;
      overflow: auto;
      list-style: none;
    }
    .hint {
      display: block;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    mat-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignExamsDialogComponent {
  private readonly data = inject<AssignExamsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AssignExamsDialogComponent>);
  private readonly store = inject(Store);

  protected readonly exams = this.store.selectSignal(selectExams);
  protected readonly saving = this.store.selectSignal(selectCandidatesSaving);
  private readonly candidates = this.store.selectSignal(selectCandidateDictionary);

  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly count = computed(() => this.data.candidateIds.length);
  protected readonly firstName = computed(() =>
    this.count() === 1 ? (this.candidates()[this.data.candidateIds[0]]?.name ?? null) : null,
  );

  /** exam id → how many of the selected candidates already have it. */
  protected readonly alreadyAssigned = computed(() => {
    const counts: Record<string, number> = {};
    for (const id of this.data.candidateIds) {
      for (const a of this.candidates()[id]?.assignments ?? []) {
        counts[a.exam_id] = (counts[a.exam_id] ?? 0) + 1;
      }
    }
    return counts;
  });

  constructor() {
    inject(Actions)
      .pipe(ofType(AdminExamsActions.assignCandidatesSuccess), takeUntilDestroyed())
      .subscribe(() => this.dialogRef.close(true));
  }

  protected toggle(examId: string): void {
    const next = new Set(this.chosen());
    if (next.has(examId)) next.delete(examId);
    else next.add(examId);
    this.chosen.set(next);
  }

  protected assign(): void {
    this.store.dispatch(
      AdminExamsActions.assignCandidates({
        candidateIds: this.data.candidateIds,
        examIds: [...this.chosen()],
      }),
    );
  }
}
