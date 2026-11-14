import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectQuestions,
  selectQuestionsLoading,
  selectResultDictionary,
  selectResultsSaving,
} from '../../store/exams.selectors';
import { gradeResult } from '../../grading';

/**
 * The answers of one submission, for grading: MCQ answers are marked
 * automatically, Input answers get correct/wrong from the admin (exact matches
 * are pre-marked as a suggestion). Saving stores every mark plus the new score.
 * Used on the result review page.
 */
@Component({
  selector: 'app-result-answers',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './result-answers.component.html',
  styleUrl: './result-answers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultAnswersComponent {
  readonly resultId = input.required<string>();
  readonly examId = input.required<string>();
  private readonly store = inject(Store);

  private readonly allQuestions = this.store.selectSignal(selectQuestions);
  protected readonly questionsLoading = this.store.selectSignal(selectQuestionsLoading);
  protected readonly saving = this.store.selectSignal(selectResultsSaving);
  private readonly resultDict = this.store.selectSignal(selectResultDictionary);
  protected readonly result = computed(() => this.resultDict()[this.resultId()] ?? null);
  private questionsRequested = false;

  private readonly questions = computed(() =>
    this.allQuestions().filter((q) => q.exam_id === this.examId()),
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
  protected readonly percent = computed(() =>
    this.answers().length ? Math.round((this.score() / this.answers().length) * 100) : 0,
  );

  constructor() {
    // Questions for this exam may not be in the store yet (e.g. opened from the all-results page).
    // Request once only, so an exam with no questions can't cause a reload loop.
    effect(() => {
      if (!this.questionsRequested && !this.questionsLoading() && this.questions().length === 0) {
        this.questionsRequested = true;
        this.store.dispatch(AdminExamsActions.loadQuestions({ examId: this.examId() }));
      }
    });
  }

  protected mark(questionId: string, correct: boolean): void {
    this.overrides.update((o) => ({ ...o, [questionId]: correct }));
  }

  /** Unsaved changes on this page. */
  protected readonly dirty = computed(() => Object.keys(this.overrides()).length > 0);

  protected save(): void {
    const answers = this.answers();
    const gradedAnswers: Record<string, boolean> = {};
    for (const a of answers) {
      if (a.correct !== null) gradedAnswers[a.question.id] = a.correct;
    }
    this.store.dispatch(
      AdminExamsActions.submitGrading({
        resultId: this.resultId(),
        gradedAnswers,
        newScore: this.score(),
        isFullyGraded: this.pending() === 0,
      }),
    );
    this.overrides.set({});
  }
}
