import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import { selectCandidatesSaving } from '../../store/exams.selectors';
import {
  generatePasscode,
  generateUsername,
  USERNAME_PATTERN,
} from '../../../../shared/utils/credentials';

export interface AddCandidateDialogData {
  examId: string;
  /** Usernames already in use, to suggest a unique one. */
  takenUsernames: ReadonlySet<string>;
}

@Component({
  selector: 'app-add-candidate-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Add candidate</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field>
          <mat-label>Full name</mat-label>
          <input
            matInput
            formControlName="name"
            required
            cdkFocusInitial
            (blur)="suggestUsername()"
          />
          <mat-error>Name is required.</mat-error>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Username</mat-label>
          <input matInput formControlName="username" required autocomplete="off" />
          <mat-hint>Filled from the name; you can change it.</mat-hint>
          @if (form.controls.username.hasError('taken')) {
            <mat-error>This username is already used.</mat-error>
          } @else {
            <mat-error>3–40 lowercase letters, digits, dots, dashes or underscores.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Passcode</mat-label>
          <input matInput formControlName="passcode" readonly class="mono" />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="regenerate()"
            matTooltip="Generate another"
            aria-label="Generate another passcode"
          >
            <mat-icon>refresh</mat-icon>
          </button>
          <mat-hint
            >Share this with the candidate. It is also shown in the candidates table.</mat-hint
          >
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          @if (saving()) {
            <mat-spinner diameter="18" />
          }
          Add candidate
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 8px;
    }
    .mono {
      font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
      letter-spacing: 0.1em;
    }
    mat-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCandidateDialogComponent {
  private readonly data = inject<AddCandidateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AddCandidateDialogComponent>);
  private readonly store = inject(Store);
  protected readonly saving = this.store.selectSignal(selectCandidatesSaving);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    username: [
      '',
      [
        Validators.required,
        Validators.pattern(USERNAME_PATTERN),
        // Synchronous "unique" check against the usernames we know about.
        (c: { value: string }) => (this.data.takenUsernames.has(c.value) ? { taken: true } : null),
      ],
    ],
    passcode: [generatePasscode()],
  });

  constructor() {
    inject(Actions)
      .pipe(ofType(AdminExamsActions.createCandidatesSuccess), takeUntilDestroyed())
      .subscribe(() => this.dialogRef.close(true));
  }

  /** Fills the username from the name, unless the admin already typed one. */
  protected suggestUsername(): void {
    const { name, username } = this.form.getRawValue();
    if (name.trim() && !username) {
      this.form.controls.username.setValue(generateUsername(name, this.data.takenUsernames));
    }
  }

  protected regenerate(): void {
    this.form.controls.passcode.setValue(generatePasscode());
  }

  protected save(): void {
    this.suggestUsername();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, username, passcode } = this.form.getRawValue();
    this.store.dispatch(
      AdminExamsActions.createCandidates({
        candidates: [
          {
            exam_id: this.data.examId,
            name: name.trim(),
            username,
            passcode,
            has_attempted: false,
          },
        ],
      }),
    );
  }
}
