import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectExamDictionary,
  selectExamsError,
  selectExamsLoading,
  selectExamsSaving,
} from '../../store/exams.selectors';
import { ExamActionsService } from '../../exam-actions.service';
import { ExamFormComponent, ExamFormValue } from '../exam-form/exam-form.component';
import { QuestionFormComponent } from '../question-form/question-form.component';
import { CandidatesTableComponent } from '../candidates/candidates-table.component';
import { ResultsTableComponent } from '../results/results-table.component';

const TABS = ['questions', 'candidates', 'results', 'settings'] as const;
type Tab = (typeof TABS)[number];

/** /admin/exams/:id: one exam with Questions, Candidates, Results and Settings tabs. */
@Component({
  selector: 'app-exam-detail',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTabsModule,
    ExamFormComponent,
    QuestionFormComponent,
    CandidatesTableComponent,
    ResultsTableComponent,
  ],
  templateUrl: './exam-detail.component.html',
  styleUrl: './exam-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamDetailComponent {
  /** Route param :id, bound by withComponentInputBinding. */
  readonly id = input.required<string>();
  /** Optional ?tab=settings query param, so a tab can be linked to directly. */
  readonly tab = input<Tab>();

  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly examActions = inject(ExamActionsService);
  private readonly settingsForm = viewChild(ExamFormComponent);

  private readonly exams = this.store.selectSignal(selectExamDictionary);
  protected readonly loading = this.store.selectSignal(selectExamsLoading);
  protected readonly saving = this.store.selectSignal(selectExamsSaving);
  protected readonly error = this.store.selectSignal(selectExamsError);

  protected readonly exam = computed(() => this.exams()[this.id()] ?? null);
  protected readonly selectedTabIndex = computed(() =>
    Math.max(0, TABS.indexOf(this.tab() ?? 'questions')),
  );

  /** Exams finished loading but this id isn't among them. */
  protected readonly notFound = computed(() => !this.exam() && !this.loading() && this.loaded);
  private loaded = false;

  constructor() {
    // Opening this page directly (refresh / shared link): load exams if the store is empty.
    effect(() => {
      if (!this.exam() && !this.loading() && !this.loaded) {
        this.loaded = true;
        this.store.dispatch(AdminExamsActions.loadExams());
      }
    });

    const actions$ = inject(Actions);

    // Go back to the list once this exam is deleted.
    actions$
      .pipe(ofType(AdminExamsActions.deleteExamSuccess), takeUntilDestroyed())
      .subscribe(({ id }) => {
        if (id === this.id()) this.router.navigate(['/admin/exams']);
      });

    // Open the copy right after duplicating.
    actions$
      .pipe(ofType(AdminExamsActions.duplicateExamSuccess), takeUntilDestroyed())
      .subscribe(({ exam }) => this.router.navigate(['/admin/exams', exam.id]));

    // Settings saved: the form's current values are now the saved state.
    actions$
      .pipe(ofType(AdminExamsActions.updateExamSuccess), takeUntilDestroyed())
      .subscribe(() => this.settingsForm()?.markSaved());
  }

  protected onTabChange(index: number): void {
    this.router.navigate([], {
      queryParams: { tab: index === 0 ? null : TABS[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected saveSettings(value: ExamFormValue): void {
    this.store.dispatch(AdminExamsActions.updateExam({ id: this.id(), changes: value }));
  }
}
