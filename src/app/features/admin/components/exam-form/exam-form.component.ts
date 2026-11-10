import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Exam } from '../../../../shared/models/exam.model';

/** The editable fields of an exam. */
export interface ExamFormValue {
  title: string;
  description: string | null;
  duration_minutes: number;
}

/**
 * Presentational form for creating or editing an exam.
 * It only emits values; the parent decides which store action to dispatch.
 * Used by the create/edit dialog and the exam detail Settings tab.
 */
@Component({
  selector: 'app-exam-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './exam-form.component.html',
  styleUrl: './exam-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamFormComponent {
  /** Exam to edit; leave empty to create a new one. */
  readonly exam = input<Exam | null>(null);
  readonly submitLabel = input('Save');
  readonly saving = input(false);
  readonly showCancel = input(true);

  readonly submitted = output<ExamFormValue>();
  readonly cancelled = output<void>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    duration_minutes: [60, [Validators.required, Validators.min(1), Validators.max(600)]],
  });

  constructor() {
    // Fill the form whenever the exam input changes (e.g. after it loads).
    effect(() => {
      const exam = this.exam();
      if (exam) {
        this.form.reset({
          title: exam.title,
          description: exam.description ?? '',
          duration_minutes: exam.duration_minutes,
        });
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description, duration_minutes } = this.form.getRawValue();
    this.submitted.emit({
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes,
    });
  }

  /** True when the form differs from the exam being edited. */
  get isDirty(): boolean {
    return this.form.dirty;
  }

  /** Mark current values as the saved state (call after a successful save). */
  markSaved(): void {
    this.form.markAsPristine();
  }
}
