import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DEFAULT_EXAM_SETTINGS, Exam, ExamSettings } from '../../../../shared/models/exam.model';

/** The editable fields of an exam. Settings are only included when `showSettings` is on. */
export interface ExamFormValue extends Partial<ExamSettings> {
  title: string;
  description: string | null;
  duration_minutes: number;
}

/**
 * Presentational form for creating or editing an exam.
 * It only emits values; the parent decides which store action to dispatch.
 * Used by the create/edit dialog (basics only) and the exam detail Settings tab (basics + settings).
 */
@Component({
  selector: 'app-exam-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
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
  /** Show scoring, question order and proctoring settings. */
  readonly showSettings = input(false);

  readonly submitted = output<ExamFormValue>();
  readonly cancelled = output<void>();

  protected readonly warningOptions = [0, 1, 2, 3, 4, 5];
  protected readonly intervalOptions = [
    { value: 30, label: 'Every 30 seconds' },
    { value: 60, label: 'Every minute' },
    { value: 90, label: 'Every 1½ minutes' },
    { value: 120, label: 'Every 2 minutes' },
    { value: 300, label: 'Every 5 minutes' },
  ];

  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    duration_minutes: [60, [Validators.required, Validators.min(1), Validators.max(600)]],
    // Settings. Pass mark is optional: empty = no pass mark.
    pass_mark: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]),
    shuffle_questions: [DEFAULT_EXAM_SETTINGS.shuffle_questions],
    shuffle_options: [DEFAULT_EXAM_SETTINGS.shuffle_options],
    camera_required: [DEFAULT_EXAM_SETTINGS.camera_required],
    max_warnings: [DEFAULT_EXAM_SETTINGS.max_warnings],
    snapshot_interval_seconds: [DEFAULT_EXAM_SETTINGS.snapshot_interval_seconds],
  });

  /** Proctoring options only matter when the camera is required. */
  protected readonly cameraRequired = toSignal(this.form.controls.camera_required.valueChanges, {
    initialValue: this.form.controls.camera_required.value,
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
          pass_mark: exam.pass_mark,
          shuffle_questions: exam.shuffle_questions,
          shuffle_options: exam.shuffle_options,
          camera_required: exam.camera_required,
          max_warnings: exam.max_warnings,
          snapshot_interval_seconds: exam.snapshot_interval_seconds,
        });
      }
    });
  }

  /** "After N warnings, the next violation submits the exam." */
  protected warningsHint(n: number): string {
    if (n === 0) return 'The first violation submits the exam immediately.';
    return `${n} warning${n === 1 ? '' : 's'}, then the next violation submits the exam automatically.`;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const basics = {
      title: v.title.trim(),
      description: v.description.trim() || null,
      duration_minutes: v.duration_minutes,
    };
    if (!this.showSettings()) {
      this.submitted.emit(basics);
      return;
    }
    this.submitted.emit({
      ...basics,
      // An empty number field gives null; keep whole numbers only.
      pass_mark:
        v.pass_mark === null || (v.pass_mark as unknown) === '' ? null : Math.round(v.pass_mark),
      shuffle_questions: v.shuffle_questions,
      shuffle_options: v.shuffle_options,
      camera_required: v.camera_required,
      max_warnings: v.max_warnings,
      snapshot_interval_seconds: v.snapshot_interval_seconds,
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
