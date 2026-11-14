import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
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
import { Result } from '../../../../shared/models/result.model';
import { downloadCsv, slugify, toCsv } from '../../../../shared/utils/csv';
import { GradingDialogComponent, GradingDialogData } from './grading-dialog.component';
import { PassOutcome, passOutcome } from '../../grading';

type GradingStatus = 'graded' | 'needs-grading';

interface ResultRow extends Result {
  candidateName: string;
  candidateUsername: string;
  examTitle: string;
  /** Number of questions, when this exam's questions are loaded (exam tab). */
  total: number | null;
  percent: number | null;
  status: GradingStatus;
  /** null when the exam has no pass mark (or the percentage is unknown). */
  outcome: PassOutcome | null;
}

/**
 * Results table. With `examId`: one exam's results with summary cards (exam detail tab).
 * Without it: recent results across all exams (sidebar Results page).
 */
@Component({
  selector: 'app-results-table',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './results-table.component.html',
  styleUrl: './results-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsTableComponent implements OnInit, AfterViewInit {
  readonly examId = input<string>();
  /** Initial grading filter, e.g. from ?status=needs-grading. */
  readonly initialStatus = input<'all' | GradingStatus>('all');

  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  private readonly results = this.store.selectSignal(selectResults);
  private readonly candidateDict = this.store.selectSignal(selectCandidateDictionary);
  private readonly examDict = this.store.selectSignal(selectExamDictionary);
  private readonly questions = this.store.selectSignal(selectQuestions);
  protected readonly exams = this.store.selectSignal(selectExams);
  protected readonly loading = this.store.selectSignal(selectResultsLoading);
  protected readonly error = this.store.selectSignal(selectResultsError);

  protected readonly allExamsMode = computed(() => !this.examId());
  protected readonly search = signal('');
  protected readonly examFilter = signal('all');
  protected readonly statusFilter = signal<'all' | GradingStatus>('all');

  /** Question count per exam, from whatever questions are in the store. */
  private readonly questionCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const q of this.questions()) counts[q.exam_id] = (counts[q.exam_id] ?? 0) + 1;
    return counts;
  });

  protected readonly rows = computed<ResultRow[]>(() => {
    const candidates = this.candidateDict();
    const exams = this.examDict();
    const counts = this.questionCounts();
    const examId = this.examId();
    const examFilter = this.examFilter();
    const statusFilter = this.statusFilter();

    return this.results()
      .filter((r) =>
        examId ? r.exam_id === examId : examFilter === 'all' || r.exam_id === examFilter,
      )
      .map((r) => {
        const total = counts[r.exam_id] ?? null;
        const status: GradingStatus = r.is_fully_graded ? 'graded' : 'needs-grading';
        const percent = total ? Math.round(((r.score ?? 0) / total) * 100) : null;
        return {
          ...r,
          candidateName: candidates[r.candidate_id]?.name ?? 'Unknown candidate',
          candidateUsername: candidates[r.candidate_id]?.username ?? '',
          examTitle: exams[r.exam_id]?.title ?? 'Unknown exam',
          total,
          percent,
          status,
          outcome: passOutcome(percent, exams[r.exam_id]?.pass_mark ?? null),
        };
      })
      .filter((r) => statusFilter === 'all' || r.status === statusFilter);
  });

  /** Summary over the exam's results (ignores the status filter). */
  protected readonly summary = computed(() => {
    const examId = this.examId();
    const all = this.results().filter((r) => !examId || r.exam_id === examId);
    const total = examId ? (this.questionCounts()[examId] ?? 0) : 0;
    const percents = total ? all.map((r) => ((r.score ?? 0) / total) * 100) : [];
    const passMark = examId ? (this.examDict()[examId]?.pass_mark ?? null) : null;
    const outcomes = percents.map((p) => passOutcome(p, passMark));
    const passed = outcomes.filter((o) => o === 'pass').length;
    const avg = percents.length
      ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length)
      : null;
    return {
      submitted: all.length,
      needsGrading: all.filter((r) => !r.is_fully_graded).length,
      average: avg,
      highest: percents.length ? Math.round(Math.max(...percents)) : null,
      lowest: percents.length ? Math.round(Math.min(...percents)) : null,
      passMark,
      /** % of submissions that passed; null without a pass mark. */
      passRate:
        passMark !== null && percents.length ? Math.round((passed / percents.length) * 100) : null,
      flagged: all.filter((r) => r.terminated_by_proctoring || r.violation_count > 0).length,
    };
  });

  protected readonly displayedColumns = computed(() =>
    this.allExamsMode()
      ? ['candidate', 'exam', 'score', 'submitted', 'status', 'actions']
      : ['candidate', 'score', 'submitted', 'status', 'actions'],
  );

  protected readonly dataSource = new MatTableDataSource<ResultRow>([]);

  constructor() {
    this.dataSource.filterPredicate = (row, term) =>
      [row.candidateName, row.candidateUsername, row.examTitle].some((v) =>
        v.toLowerCase().includes(term),
      );
    // Sort by the computed fields, not the raw ones.
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'candidate':
          return row.candidateName.toLowerCase();
        case 'exam':
          return row.examTitle.toLowerCase();
        case 'score':
          return row.percent ?? row.score ?? 0;
        case 'submitted':
          return row.submitted_at;
        default:
          return row.status;
      }
    };

    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.filter = this.search().trim().toLowerCase();
      this.dataSource.paginator?.firstPage();
    });
  }

  ngOnInit(): void {
    this.statusFilter.set(this.initialStatus());
    this.reload();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.paginator = this.paginator() ?? null;
  }

  protected reload(): void {
    const examId = this.examId();
    // Candidate names come from the candidates slice; exam titles from the exams slice.
    this.store.dispatch(AdminExamsActions.loadCandidates({ examId }));
    if (examId) {
      this.store.dispatch(AdminExamsActions.loadResultsForExam({ examId }));
      // Question count gives "x / N" and percentages.
      if (!this.questionCounts()[examId])
        this.store.dispatch(AdminExamsActions.loadQuestions({ examId }));
    } else {
      this.store.dispatch(AdminExamsActions.loadAllResults());
      if (this.exams().length === 0) this.store.dispatch(AdminExamsActions.loadExams());
    }
  }

  protected openGrading(row: ResultRow): void {
    this.dialog.open<GradingDialogComponent, GradingDialogData>(GradingDialogComponent, {
      data: {
        resultId: row.id,
        examId: row.exam_id,
        candidateName: row.candidateName,
        examTitle: row.examTitle,
      },
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: 'dialog',
    });
  }

  protected exportCsv(): void {
    const csv = toCsv(this.dataSource.filteredData, [
      { header: 'Candidate', value: (r) => r.candidateName },
      { header: 'Username', value: (r) => r.candidateUsername },
      { header: 'Exam', value: (r) => r.examTitle },
      { header: 'Score', value: (r) => r.score ?? '' },
      { header: 'Out of', value: (r) => r.total ?? '' },
      { header: 'Percent', value: (r) => (r.percent === null ? '' : `${r.percent}%`) },
      {
        header: 'Result',
        value: (r) => (r.outcome === null ? '' : r.outcome === 'pass' ? 'Pass' : 'Fail'),
      },
      { header: 'Attempt', value: (r) => r.attempt_number },
      { header: 'Violations', value: (r) => r.violation_count },
      { header: 'Ended by proctoring', value: (r) => (r.terminated_by_proctoring ? 'Yes' : 'No') },
      { header: 'Submitted', value: (r) => new Date(r.submitted_at).toLocaleString() },
      { header: 'Status', value: (r) => (r.status === 'graded' ? 'Graded' : 'Needs grading') },
    ]);
    const exam = this.examId() ? this.examDict()[this.examId()!]?.title : 'all-exams';
    downloadCsv(`results-${slugify(exam ?? 'exam')}.csv`, csv);
  }
}
