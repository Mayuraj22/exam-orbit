import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
import { needsProctoringReview } from '../../../../shared/models/result.model';

const LIST_SIZE = 5;

/** /admin: overview of exams, candidates and submissions with quick links. */
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
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

  protected readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  protected readonly today = new Date();

  protected readonly stats = computed(() => {
    const exams = this.exams();
    const results = this.results();
    return [
      {
        label: 'Live exams',
        value: exams.filter((e) => e.is_published).length,
        link: '/admin/exams',
      },
      { label: 'Candidates', value: this.candidates().length, link: '/admin/candidates' },
      { label: 'Submissions', value: results.length, link: '/admin/results' },
      {
        label: 'Graded',
        value: results.filter((r) => r.is_fully_graded).length,
        link: '/admin/results',
      },
    ];
  });

  protected readonly todoCount = computed(
    () =>
      this.results().filter((r) => !r.is_fully_graded).length +
      this.results().filter(needsProctoringReview).length,
  );

  /** One line under the greeting summarising what needs doing. */
  protected readonly subtitle = computed(() => {
    const todo = this.todoCount();
    return todo
      ? `${todo} item${todo === 1 ? '' : 's'} waiting for you`
      : 'Everything is up to date';
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

  /** Flagged by proctoring and waiting for a decision. */
  protected readonly needsReview = computed(() =>
    this.describe().filter(needsProctoringReview).slice(0, LIST_SIZE),
  );

  /** Results arrive sorted newest first from the adapter. */
  protected readonly recent = computed(() => this.describe().slice(0, LIST_SIZE));

  ngOnInit(): void {
    this.store.dispatch(AdminExamsActions.loadExams());
    this.store.dispatch(AdminExamsActions.loadCandidates());
    this.store.dispatch(AdminExamsActions.loadAllResults());
  }

  protected newExam(): void {
    this.examActions.openEditor().subscribe((created) => {
      if (created) this.router.navigate(['/admin/exams', created.id]);
    });
  }
}
