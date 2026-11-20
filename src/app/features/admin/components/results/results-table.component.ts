import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectCandidateDictionary,
  selectExamDictionary,
  selectExams,
  selectQuestions,
  selectResults,
  selectResultsError,
  selectResultsLoading,
} from '../../store/exams.selectors';
import { needsProctoringReview } from '../../../../shared/models/result.model';
import { downloadCsv, slugify, toCsv } from '../../../../shared/utils/csv';
import { initials, relativeDate } from '../../../../shared/utils/relative-date';
import { passOutcome, ResultOutcome, resultOutcome } from '../../grading';
import { BADGE_LABELS, badgeFor, GradingStatus, ResultRow } from './result-row';
import { ResultSummaryPanelComponent } from './result-summary-panel.component';

const OUTCOME_LABELS: Record<ResultOutcome, string> = {
  pass: 'Pass',
  fail: 'Fail',
  disqualified: 'Disqualified',
};
const REVIEW_LABELS = {
  cleared: 'Cleared',
  suspicious: 'Suspicious',
  disqualified: 'Disqualified',
};

/** List filter: grading status, or flagged and waiting for a proctoring decision. */
type StatusFilter = 'all' | GradingStatus | 'needs-review';

/**
 * Results in a split view: the list on the left, the selected submission on
 * the right (score, result, warnings, photo preview, links to grade/review).
 * With `examId` it shows one exam (exam's Results tab); without, every exam.
 * On narrow screens the list opens the full review page instead.
 */
@Component({
  selector: 'app-results-table',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    ResultSummaryPanelComponent,
  ],
  templateUrl: './results-table.component.html',
  styleUrl: './results-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsTableComponent implements OnInit {
  readonly examId = input<string>();
  /** Initial filter, e.g. from ?status=needs-grading. */
  readonly initialStatus = input<StatusFilter>('all');

  private readonly store = inject(Store);
  private readonly router = inject(Router);

  private readonly results = this.store.selectSignal(selectResults);
  private readonly candidateDict = this.store.selectSignal(selectCandidateDictionary);
  private readonly examDict = this.store.selectSignal(selectExamDictionary);
  private readonly questions = this.store.selectSignal(selectQuestions);
  protected readonly exams = this.store.selectSignal(selectExams);
  protected readonly loading = this.store.selectSignal(selectResultsLoading);
  protected readonly error = this.store.selectSignal(selectResultsError);

  /** Below this width there's no room for the side panel. */
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 899px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly allExamsMode = computed(() => !this.examId());
  protected readonly search = signal('');
  protected readonly examFilter = signal('all');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly badgeLabels = BADGE_LABELS;

  /** Question count per exam, from whatever questions are in the store. */
  private readonly questionCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const q of this.questions()) counts[q.exam_id] = (counts[q.exam_id] ?? 0) + 1;
    return counts;
  });

  /** Every result in scope (exam / exam filter), before status and search filters. */
  private readonly scoped = computed<ResultRow[]>(() => {
    const candidates = this.candidateDict();
    const exams = this.examDict();
    const counts = this.questionCounts();
    const examId = this.examId();
    const examFilter = this.examFilter();

    return this.results()
      .filter((r) =>
        examId ? r.exam_id === examId : examFilter === 'all' || r.exam_id === examFilter,
      )
      .map((r) => {
        const total = counts[r.exam_id] ?? null;
        const status: GradingStatus = r.is_fully_graded ? 'graded' : 'needs-grading';
        const percent = total ? Math.round(((r.score ?? 0) / total) * 100) : null;
        const outcome = resultOutcome(
          percent,
          exams[r.exam_id]?.pass_mark ?? null,
          r.review_status,
        );
        const name = candidates[r.candidate_id]?.name ?? 'Unknown candidate';
        const passMark = exams[r.exam_id]?.pass_mark ?? null;
        return {
          ...r,
          candidateName: name,
          candidateUsername: candidates[r.candidate_id]?.username ?? '',
          examTitle: exams[r.exam_id]?.title ?? 'Unknown exam',
          initials: initials(name),
          total,
          percent,
          status,
          outcome,
          needsReview: needsProctoringReview(r),
          badge: badgeFor(outcome, status),
          submittedLabel: relativeDate(r.submitted_at),
          passMark,
        };
      })
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  });

  /** Counts shown on the filter chips. */
  protected readonly counts = computed(() => {
    const rows = this.scoped();
    return {
      all: rows.length,
      'needs-grading': rows.filter((r) => r.status === 'needs-grading').length,
      'needs-review': rows.filter((r) => r.needsReview).length,
      graded: rows.filter((r) => r.status === 'graded').length,
    } satisfies Record<StatusFilter, number>;
  });

  protected readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'needs-grading', label: 'To grade' },
    { value: 'needs-review', label: 'To review' },
    { value: 'graded', label: 'Graded' },
  ];

  /** The list as shown. */
  protected readonly rows = computed(() => {
    const status = this.statusFilter();
    const term = this.search().trim().toLowerCase();
    return this.scoped()
      .filter((r) =>
        status === 'all' ? true : status === 'needs-review' ? r.needsReview : r.status === status,
      )
      .filter(
        (r) =>
          !term ||
          [r.candidateName, r.candidateUsername, r.examTitle].some((v) =>
            v.toLowerCase().includes(term),
          ),
      );
  });

  /** Summary over the exam's results (exam tab), ignoring filters. */
  protected readonly summary = computed(() => {
    const examId = this.examId();
    const all = this.results().filter((r) => !examId || r.exam_id === examId);
    const total = examId ? (this.questionCounts()[examId] ?? 0) : 0;
    const percents = total ? all.map((r) => ((r.score ?? 0) / total) * 100) : [];
    const passMark = examId ? (this.examDict()[examId]?.pass_mark ?? null) : null;
    const passed = percents.filter((p) => passOutcome(p, passMark) === 'pass').length;
    return {
      submitted: all.length,
      average: percents.length
        ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length)
        : null,
      passMark,
      passRate:
        passMark !== null && percents.length ? Math.round((passed / percents.length) * 100) : null,
    };
  });

  // --- Selection and the detail panel -----------------------------------------
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(
    () => this.rows().find((r) => r.id === this.selectedId()) ?? null,
  );

  constructor() {
    // Keep a valid selection: the first row when nothing (or a filtered-out row) is selected.
    effect(() => {
      const rows = this.rows();
      if (!rows.length) {
        if (this.selectedId() !== null) this.selectedId.set(null);
        return;
      }
      if (!rows.some((r) => r.id === this.selectedId())) this.selectedId.set(rows[0].id);
    });

    // The panel's question dots and "x / N" need the selected exam's questions.
    effect(() => {
      const row = this.selected();
      if (row && !this.narrow() && !this.questionCounts()[row.exam_id]) {
        this.store.dispatch(AdminExamsActions.loadQuestions({ examId: row.exam_id }));
      }
    });
  }

  ngOnInit(): void {
    this.statusFilter.set(this.initialStatus());
    this.reload();
  }

  protected reload(): void {
    const examId = this.examId();
    this.store.dispatch(AdminExamsActions.loadCandidates());
    if (examId) {
      this.store.dispatch(AdminExamsActions.loadResultsForExam({ examId }));
      if (!this.questionCounts()[examId]) {
        this.store.dispatch(AdminExamsActions.loadQuestions({ examId }));
      }
    } else {
      this.store.dispatch(AdminExamsActions.loadAllResults());
      if (this.exams().length === 0) this.store.dispatch(AdminExamsActions.loadExams());
    }
  }

  /** Click a row: select it (wide screens) or open the full page (narrow screens). */
  protected choose(row: ResultRow): void {
    if (this.narrow()) {
      void this.router.navigate(['/admin/results', row.id]);
      return;
    }
    this.selectedId.set(row.id);
  }

  /** ↑ / ↓ move through the list, Enter opens the full review. */
  protected onListKey(event: KeyboardEvent): void {
    const rows = this.rows();
    const i = rows.findIndex((r) => r.id === this.selectedId());
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next =
        rows[Math.min(Math.max(i + (event.key === 'ArrowDown' ? 1 : -1), 0), rows.length - 1)];
      if (next) {
        this.selectedId.set(next.id);
        queueMicrotask(() =>
          document.getElementById(`result-${next.id}`)?.scrollIntoView({ block: 'nearest' }),
        );
      }
    } else if (event.key === 'Enter' && i >= 0) {
      void this.router.navigate(['/admin/results', rows[i].id]);
    }
  }

  protected exportCsv(): void {
    const csv = toCsv(this.rows(), [
      { header: 'Candidate', value: (r) => r.candidateName },
      { header: 'Username', value: (r) => r.candidateUsername },
      { header: 'Exam', value: (r) => r.examTitle },
      { header: 'Score', value: (r) => r.score ?? '' },
      { header: 'Out of', value: (r) => r.total ?? '' },
      { header: 'Percent', value: (r) => (r.percent === null ? '' : `${r.percent}%`) },
      { header: 'Result', value: (r) => (r.outcome ? OUTCOME_LABELS[r.outcome] : '') },
      { header: 'Attempt', value: (r) => r.attempt_number },
      { header: 'Review', value: (r) => (r.review_status ? REVIEW_LABELS[r.review_status] : '') },
      { header: 'Review note', value: (r) => r.review_note ?? '' },
      { header: 'Violations', value: (r) => r.violation_count },
      { header: 'Ended by proctoring', value: (r) => (r.terminated_by_proctoring ? 'Yes' : 'No') },
      { header: 'Submitted', value: (r) => new Date(r.submitted_at).toLocaleString() },
      { header: 'Status', value: (r) => (r.status === 'graded' ? 'Graded' : 'Needs grading') },
    ]);
    const exam = this.examId() ? this.examDict()[this.examId()!]?.title : 'all-exams';
    downloadCsv(`results-${slugify(exam ?? 'exam')}.csv`, csv);
  }
}
