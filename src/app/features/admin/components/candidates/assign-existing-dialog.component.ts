import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import { selectCandidates, selectCandidatesSaving } from '../../store/exams.selectors';
import { assignmentFor } from '../../../../shared/models/candidate.model';

export interface AssignExistingDialogData {
  examId: string;
  examTitle: string;
}

/** From an exam: pick existing candidates (search + multi-select) to assign to it. */
@Component({
  selector: 'app-assign-existing-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Assign candidates to {{ data.examTitle }}</h2>
    <mat-dialog-content>
      <mat-form-field class="search" appearance="outline" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Search by name, username or email</mat-label>
        <input matInput [value]="search()" (input)="search.set($any($event.target).value)" />
      </mat-form-field>

      @if (available().length) {
        <div class="select-all">
          <mat-checkbox
            [checked]="allVisibleChosen()"
            [indeterminate]="chosen().size > 0 && !allVisibleChosen()"
            (change)="toggleAllVisible()"
          >
            Select all shown ({{ visible().length }})
          </mat-checkbox>
        </div>
        <ul class="people">
          @for (c of visible(); track c.id) {
            <li>
              <mat-checkbox [checked]="chosen().has(c.id)" (change)="toggle(c.id)">
                {{ c.name }}
                <span class="hint">{{ c.username }}{{ c.email ? ' · ' + c.email : '' }}</span>
              </mat-checkbox>
            </li>
          } @empty {
            <li class="hint">No one matches "{{ search() }}".</li>
          }
        </ul>
      } @else {
        <p class="hint">
          Everyone is already assigned to this exam. Use Add candidate to create someone new.
        </p>
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
        Assign {{ chosen().size || '' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .search {
      width: 100%;
      margin-bottom: 8px;
    }
    .select-all {
      padding: 4px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .people {
      display: flex;
      flex-direction: column;
      max-height: 340px;
      margin: 0;
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
export class AssignExistingDialogComponent {
  protected readonly data = inject<AssignExistingDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AssignExistingDialogComponent>);
  private readonly store = inject(Store);
  private readonly candidates = this.store.selectSignal(selectCandidates);
  protected readonly saving = this.store.selectSignal(selectCandidatesSaving);

  protected readonly search = signal('');
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());

  /** Candidates not yet assigned to this exam. */
  protected readonly available = computed(() =>
    this.candidates().filter((c) => !assignmentFor(c, this.data.examId)),
  );
  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.available().filter(
      (c) =>
        !term || [c.name, c.username, c.email ?? ''].some((v) => v.toLowerCase().includes(term)),
    );
  });
  protected readonly allVisibleChosen = computed(
    () => this.visible().length > 0 && this.visible().every((c) => this.chosen().has(c.id)),
  );

  constructor() {
    inject(Actions)
      .pipe(ofType(AdminExamsActions.assignCandidatesSuccess), takeUntilDestroyed())
      .subscribe(() => this.dialogRef.close(true));
  }

  protected toggle(id: string): void {
    const next = new Set(this.chosen());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.chosen.set(next);
  }

  protected toggleAllVisible(): void {
    const next = new Set(this.chosen());
    const all = this.allVisibleChosen();
    for (const c of this.visible()) {
      if (all) next.delete(c.id);
      else next.add(c.id);
    }
    this.chosen.set(next);
  }

  protected assign(): void {
    this.store.dispatch(
      AdminExamsActions.assignCandidates({
        candidateIds: [...this.chosen()],
        examIds: [this.data.examId],
      }),
    );
  }
}
