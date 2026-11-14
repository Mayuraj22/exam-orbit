import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectExamDictionary,
  selectQuestions,
  selectQuestionsLoading,
  selectResultDictionary,
  selectResultsSaving,
} from '../../store/exams.selectors';
import { gradeResult, passOutcome } from '../../grading';

export interface GradingDialogData {
  resultId: string;
  examId: string;
  candidateName: string;
  examTitle: string;
}

/**
 * Review one submission: MCQ answers are marked automatically, Input answers
 * get ✓/✗ from the admin (exact matches are pre-marked as a suggestion).
 * Saving stores every mark plus the new score.
 */
@Component({
  selector: 'app-grading-dialog',
  imports: [
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './grading-dialog.component.html',
  styleUrl: './grading-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradingDialogComponent {
  protected readonly data = inject<GradingDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GradingDialogComponent>);
  private readonly store = inject(Store);

  private readonly allQuestions = this.store.selectSignal(selectQuestions);
  protected readonly questionsLoading = this.store.selectSignal(selectQuestionsLoading);
  protected readonly saving = this.store.selectSignal(selectResultsSaving);
  private readonly resultDict = this.store.selectSignal(selectResultDictionary);
  protected readonly result = computed(() => this.resultDict()[this.data.resultId] ?? null);
  private questionsRequested = false;

  private readonly questions = computed(() =>
    this.allQuestions().filter((q) => q.exam_id === this.data.examId),
  );

  /** Admin's changes in this dialog (question id → mark), on top of the computed marks. */
  private readonly overrides = signal<Record<string, boolean>>({});

  protected readonly answers = computed(() => {
    const result = this.result();
    if (!result) return [];
    const overrides = this.overrides();
    return gradeResult(result, this.questions()).map((a) =>
      a.question.id in overrides
        ? { ...a, correct: overrides[a.question.id], source: 'manual' as const }
        : a,
    );
  });

  protected readonly score = computed(
    () => this.answers().filter((a) => a.correct === true).length,
  );
  protected readonly pending = computed(
    () => this.answers().filter((a) => a.correct === null).length,
  );
  private readonly examDict = this.store.selectSignal(selectExamDictionary);
  protected readonly passMark = computed(
    () => this.examDict()[this.data.examId]?.pass_mark ?? null,
  );
  protected readonly outcome = computed(() =>
    this.answers().length ? passOutcome(this.percent(), this.passMark()) : null,
  );

  protected readonly percent = computed(() =>
    this.answers().length ? Math.round((this.score() / this.answers().length) * 100) : 0,
  );

  constructor() {
    // Questions for this exam may not be in the store yet (e.g. opened from the all-results page).
    // Request once only, so an exam with no questions can't cause a reload loop.
    effect(() => {
      if (!this.questionsRequested && !this.questionsLoading() && this.questions().length === 0) {
        this.questionsRequested = true;
        this.store.dispatch(AdminExamsActions.loadQuestions({ examId: this.data.examId }));
      }
    });

    inject(Actions)
      .pipe(ofType(AdminExamsActions.submitGradingSuccess), takeUntilDestroyed())
      .subscribe(() => this.dialogRef.close(true));
  }

  protected mark(questionId: string, correct: boolean): void {
    this.overrides.update((o) => ({ ...o, [questionId]: correct }));
  }

  protected save(): void {
    const answers = this.answers();
    const gradedAnswers: Record<string, boolean> = {};
    for (const a of answers) {
      if (a.correct !== null) gradedAnswers[a.question.id] = a.correct;
    }
    this.store.dispatch(
      AdminExamsActions.submitGrading({
        resultId: this.data.resultId,
        gradedAnswers,
        newScore: this.score(),
        isFullyGraded: this.pending() === 0,
      }),
    );
  }
}
