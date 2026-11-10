import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectCandidateDictionary,
  selectCandidates,
  selectExamDictionary,
  selectExams,
  selectExamsLoading,
  selectResults,
  selectResultsLoading,
} from '../../store/exams.selectors';
import { ExamActionsService } from '../../exam-actions.service';

const LIST_SIZE = 5;

/** /admin: overview of exams, candidates and submissions with quick links. */
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatListModule],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly examActions = inject(ExamActionsService);

  private readonly exams = this.store.selectSignal(selectExams);
  private readonly candidates = this.store.selectSignal(selectCandidates);
  private readonly results = this.store.selectSignal(selectResults);
  private readonly examDict = this.store.selectSignal(selectExamDictionary);
  private readonly candidateDict = this.store.selectSignal(selectCandidateDictionary);
  private readonly examsLoading = this.store.selectSignal(selectExamsLoading);
  private readonly resultsLoading = this.store.selectSignal(selectResultsLoading);

  protected readonly loading = computed(() => this.examsLoading() || this.resultsLoading());

  protected readonly stats = computed(() => {
    const exams = this.exams();
    const results = this.results();
    return [
      { label: 'Exams', value: exams.length, icon: 'assignment', link: '/admin/exams', query: {} },
      {
        label: 'Published',
        value: exams.filter((e) => e.is_published).length,
        icon: 'public',
        link: '/admin/exams',
        query: { status: 'published' },
      },
      {
        label: 'Candidates',
        value: this.candidates().length,
        icon: 'groups',
        link: '/admin/candidates',
        query: {},
      },
      {
        label: 'Submissions',
        value: results.length,
        icon: 'inbox',
        link: '/admin/results',
        query: {},
      },
      {
        label: 'Needs grading',
        value: results.filter((r) => !r.is_fully_graded).length,
        icon: 'rate_review',
        link: '/admin/results',
        query: { status: 'needs-grading' },
        attention: true,
      },
    ];
  });

  /** Joins a result with its candidate and exam names. */
  private describe = computed(() => {
    const exams = this.examDict();
    const candidates = this.candidateDict();
    return this.results().map((r) => ({
      ...r,
      candidateName: candidates[r.candidate_id]?.name ?? 'Unknown candidate',
      examTitle: exams[r.exam_id]?.title ?? 'Unknown exam',
    }));
  });

  protected readonly needsGrading = computed(() =>
    this.describe()
      .filter((r) => !r.is_fully_graded)
      .slice(0, LIST_SIZE),
  );

  /** Results arrive sorted newest first from the adapter. */
  protected readonly recent = computed(() => this.describe().slice(0, LIST_SIZE));

  ngOnInit(): void {
    this.store.dispatch(AdminExamsActions.loadExams());
    this.store.dispatch(AdminExamsActions.loadCandidates({}));
    this.store.dispatch(AdminExamsActions.loadAllResults());
  }

  protected newExam(): void {
    this.examActions.openEditor().subscribe((created) => {
      if (created) this.router.navigate(['/admin/exams', created.id]);
    });
  }
}
