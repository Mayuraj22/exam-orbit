import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectExams,
  selectExamsError,
  selectExamsLoading,
  selectExamsSaving,
  selectSelectedExamId,
} from '../../store/exams.selectors';
import { Exam } from '../../../../shared/models/exam.model';
import { ExamActionsService } from '../../exam-actions.service';
import { QuestionFormComponent } from '../question-form/question-form.component';

export type StatusFilter = 'all' | 'published' | 'draft';
export type SortOption = 'newest' | 'oldest' | 'title';

const SORTERS: Record<SortOption, (a: Exam, b: Exam) => number> = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
};

@Component({
  selector: 'app-exam-list',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    QuestionFormComponent,
  ],
  templateUrl: './exam-list.component.html',
  styleUrl: './exam-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamListComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly examActions = inject(ExamActionsService);

  // Filters come from the URL query params (?q=…&status=…&sort=…) via
  // withComponentInputBinding, so they survive a refresh and can be shared.
  readonly q = input<string>();
  readonly status = input<StatusFilter>();
  readonly sort = input<SortOption>();

  protected readonly search = computed(() => (this.q() ?? '').trim());
  protected readonly statusFilter = computed<StatusFilter>(() => this.status() ?? 'all');
  protected readonly sortBy = computed<SortOption>(() => {
    const sort = this.sort();
    return sort && Object.hasOwn(SORTERS, sort) ? sort : 'newest';
  });

  protected readonly exams = this.store.selectSignal(selectExams);
  protected readonly loading = this.store.selectSignal(selectExamsLoading);
  protected readonly saving = this.store.selectSignal(selectExamsSaving);
  protected readonly error = this.store.selectSignal(selectExamsError);
  protected readonly selectedExamId = this.store.selectSignal(selectSelectedExamId);

  /** Exams after search, status filter and sort. */
  protected readonly visibleExams = computed(() => {
    const term = this.search().toLowerCase();
    const status = this.statusFilter();
    return this.exams()
      .filter((e) => status === 'all' || (status === 'published') === e.is_published)
      .filter(
        (e) =>
          !term ||
          e.title.toLowerCase().includes(term) ||
          e.description?.toLowerCase().includes(term),
      )
      .sort(SORTERS[this.sortBy()]);
  });

  protected readonly hasFilters = computed(() => !!this.search() || this.statusFilter() !== 'all');

  protected readonly counts = computed(() => {
    const all = this.exams();
    const published = all.filter((e) => e.is_published).length;
    return { all: all.length, published, draft: all.length - published };
  });

  /** Number of placeholder cards shown while the list loads. */
  protected readonly skeletons = [1, 2, 3];

  ngOnInit(): void {
    this.loadExams();
  }

  protected loadExams(): void {
    this.store.dispatch(AdminExamsActions.loadExams());
  }

  /** Writes a filter into the URL; replaceUrl keeps typing out of the back-button history. */
  protected setQueryParam(key: 'q' | 'status' | 'sort', value: string | null): void {
    const defaults: Record<string, string> = { status: 'all', sort: 'newest' };
    this.router.navigate([], {
      queryParams: { [key]: value && value !== defaults[key] ? value : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearFilters(): void {
    this.router.navigate([], {
      queryParams: { q: null, status: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected toggleQuestions(examId: string): void {
    // Clicking the open exam again ("Close Questions") deselects it.
    const nextId = this.selectedExamId() === examId ? null : examId;
    this.store.dispatch(AdminExamsActions.selectExam({ examId: nextId }));
  }

  protected createExam(): void {
    this.examActions.openEditor().subscribe((created) => {
      if (created) this.router.navigate(['/admin/exams', created.id]);
    });
  }
}
