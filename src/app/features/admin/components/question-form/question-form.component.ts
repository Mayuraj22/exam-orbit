import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmService } from '../../../../shared/components/confirm-dialog/confirm.service';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectQuestions,
  selectQuestionsError,
  selectQuestionsLoading,
  selectQuestionsSaving,
} from '../../store/exams.selectors';
import { Question, QuestionOption, QuestionType } from '../../../../shared/models/question.model';

/** `id` is empty for options added in this form; kept for existing ones so answers stay valid. */
type OptionGroup = FormGroup<{ id: FormControl<string>; text: FormControl<string> }>;

/**
 * Form-level rule for the correct answer:
 * MCQ needs a selected option, Input needs non-blank answer text.
 */
const correctAnswerValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { type, correctIndex, correct_answer, options } = group.getRawValue();
  if (type === 'mcq') {
    return correctIndex !== null && correctIndex < options.length
      ? null
      : { correctOptionRequired: true };
  }
  return correct_answer.trim() ? null : { correctAnswerRequired: true };
};

@Component({
  selector: 'app-question-form',
  imports: [
    ReactiveFormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatTooltipModule,
  ],
  templateUrl: './question-form.component.html',
  styleUrl: './question-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionFormComponent implements OnInit {
  readonly examId = input.required<string>();

  private readonly store = inject(Store);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly formSection = viewChild<ElementRef<HTMLElement>>('formSection');

  private readonly allQuestions = this.store.selectSignal(selectQuestions);
  protected readonly loading = this.store.selectSignal(selectQuestionsLoading);
  protected readonly saving = this.store.selectSignal(selectQuestionsSaving);
  protected readonly error = this.store.selectSignal(selectQuestionsError);

  /** Questions of this exam, already sorted by order_index in the entity adapter. */
  protected readonly questions = computed(() =>
    this.allQuestions().filter((q) => q.exam_id === this.examId()),
  );

  /** Question being edited, or null when the form adds a new one. */
  protected readonly editingId = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      type: this.fb.control<QuestionType>('mcq'),
      question_text: ['', Validators.required],
      options: this.fb.array<OptionGroup>([this.createOption(), this.createOption()]),
      correctIndex: new FormControl<number | null>(null),
      correct_answer: [''],
    },
    { validators: correctAnswerValidator },
  );

  constructor() {
    // Reset only after the save succeeds, so a failure keeps the admin's input.
    inject(Actions)
      .pipe(
        ofType(AdminExamsActions.createQuestionSuccess, AdminExamsActions.updateQuestionSuccess),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.resetForm());
  }

  ngOnInit(): void {
    this.store.dispatch(AdminExamsActions.loadQuestions({ examId: this.examId() }));
  }

  protected get options(): FormArray<OptionGroup> {
    return this.form.controls.options;
  }

  protected get type(): QuestionType {
    return this.form.controls.type.value;
  }

  private createOption(option?: QuestionOption): OptionGroup {
    return this.fb.group({
      id: [option?.id ?? ''],
      text: [option?.text ?? '', Validators.required],
    });
  }

  protected addOption(): void {
    this.options.push(this.createOption());
  }

  protected removeOption(index: number): void {
    if (this.options.length <= 2) return;
    this.options.removeAt(index);

    // Keep the selected correct option pointing at the same option.
    const correct = this.form.controls.correctIndex;
    if (correct.value === index) correct.setValue(null);
    else if (correct.value !== null && correct.value > index) correct.setValue(correct.value - 1);
  }

  /** Switches type and resets the type-specific fields. */
  protected setQuestionType(type: QuestionType, options: QuestionOption[] = []): void {
    this.form.controls.type.setValue(type);
    this.form.controls.correctIndex.reset(null);
    this.form.controls.correct_answer.reset('');
    // Input questions have no options: an empty array is valid and has no required fields.
    const groups =
      type === 'mcq'
        ? (options.length ? options : [undefined, undefined]).map((o) => this.createOption(o))
        : [];
    this.form.setControl('options', this.fb.array<OptionGroup>(groups));
  }

  /** Loads a question into the form for editing. */
  protected startEdit(question: Question): void {
    this.editingId.set(question.id);
    this.setQuestionType(question.question_type, question.options ?? []);
    this.form.controls.question_text.setValue(question.question_text);

    if (question.question_type === 'mcq') {
      const index = (question.options ?? []).findIndex((o) => this.isCorrectOption(question, o));
      this.form.controls.correctIndex.setValue(index >= 0 ? index : null);
    } else {
      this.form.controls.correct_answer.setValue(question.correct_answer ?? '');
    }
    this.form.markAsPristine();
    this.formSection()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected submitQuestion(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { type, question_text, options, correctIndex, correct_answer } = this.form.getRawValue();

    // New options get an id; edited ones keep theirs so existing answers stay valid.
    const mcqOptions =
      type === 'mcq'
        ? options.map((o) => ({ id: o.id || crypto.randomUUID(), text: o.text.trim() }))
        : null;

    // MCQ stores the correct option's id, so editing option wording never breaks grading.
    const correctAnswer = mcqOptions ? mcqOptions[correctIndex!].id : correct_answer.trim();

    const fields = {
      question_text: question_text.trim(),
      question_type: type,
      options: mcqOptions,
      correct_answer: correctAnswer,
    };

    const editingId = this.editingId();
    if (editingId) {
      this.store.dispatch(AdminExamsActions.updateQuestion({ id: editingId, changes: fields }));
      return;
    }

    // Next number = highest existing + 1, so deleting a question never causes duplicates.
    const nextOrder = this.questions().reduce((max, q) => Math.max(max, q.order_index), -1) + 1;
    this.store.dispatch(
      AdminExamsActions.createQuestion({
        question: { ...fields, exam_id: this.examId(), order_index: nextOrder },
      }),
    );
  }

  /** Drag-and-drop: apply the new order (optimistically) and save it. */
  protected drop(event: CdkDragDrop<Question[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const ids = this.questions().map((q) => q.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.store.dispatch(
      AdminExamsActions.reorderQuestions({ examId: this.examId(), orderedIds: ids }),
    );
  }

  /** Keyboard alternative to dragging. */
  protected move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.questions().length) return;
    const ids = this.questions().map((q) => q.id);
    moveItemInArray(ids, index, target);
    this.store.dispatch(
      AdminExamsActions.reorderQuestions({ examId: this.examId(), orderedIds: ids }),
    );
  }

  protected deleteQuestion(question: Question): void {
    this.confirm
      .ask({
        title: 'Delete question?',
        message: `"${question.question_text}" will be permanently deleted.`,
        confirmText: 'Delete',
        destructive: true,
      })
      .pipe(filter(Boolean))
      .subscribe(() => {
        if (this.editingId() === question.id) this.resetForm();
        this.store.dispatch(AdminExamsActions.deleteQuestion({ id: question.id }));
      });
  }

  /** Back to an empty "add MCQ" form (also cancels editing). */
  protected resetForm(): void {
    this.editingId.set(null);
    this.setQuestionType('mcq');
    this.form.reset({ type: 'mcq', question_text: '', correctIndex: null, correct_answer: '' });
  }

  /**
   * Whether an MCQ option is the correct one. Older rows stored the option
   * text instead of its id, so accept either.
   */
  protected isCorrectOption(question: Question, option: QuestionOption): boolean {
    return question.correct_answer === option.id || question.correct_answer === option.text;
  }

  /**
   * Form-level errors appear only after the related field was used
   * (or the admin tried to submit), not as soon as the type is switched.
   */
  protected showError(error: 'correctOptionRequired' | 'correctAnswerRequired'): boolean {
    const related =
      error === 'correctAnswerRequired'
        ? this.form.controls.correct_answer
        : this.form.controls.correctIndex;
    return related.touched && this.form.hasError(error);
  }
}
