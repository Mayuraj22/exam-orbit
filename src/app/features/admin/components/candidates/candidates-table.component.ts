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
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectCandidates,
  selectCandidatesError,
  selectCandidatesLoading,
  selectCandidatesSaving,
  selectExamDictionary,
  selectExams,
} from '../../store/exams.selectors';
import { Candidate } from '../../../../shared/models/candidate.model';
import { ConfirmService } from '../../../../shared/components/confirm-dialog/confirm.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { downloadCsv, slugify, toCsv } from '../../../../shared/utils/csv';
import {
  AddCandidateDialogComponent,
  AddCandidateDialogData,
} from './add-candidate-dialog.component';
import {
  ImportCandidatesDialogComponent,
  ImportCandidatesDialogData,
} from './import-candidates-dialog.component';

/** A candidate plus its exam title, for display, sorting and filtering. */
interface CandidateRow extends Candidate {
  examTitle: string;
  status: 'attempted' | 'not-started';
}

/**
 * Candidates table. With `examId` it shows one exam's candidates (exam detail tab)
 * and allows adding/importing; without it, every candidate with an exam filter
 * (sidebar Candidates page).
 */
@Component({
  selector: 'app-candidates-table',
  imports: [
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './candidates-table.component.html',
  styleUrl: './candidates-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidatesTableComponent implements OnInit, AfterViewInit {
  /** Limit to one exam; omit to show every exam's candidates. */
  readonly examId = input<string>();

  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly clipboard = inject(Clipboard);
  private readonly notify = inject(NotificationService);

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  private readonly candidates = this.store.selectSignal(selectCandidates);
  private readonly examDict = this.store.selectSignal(selectExamDictionary);
  protected readonly exams = this.store.selectSignal(selectExams);
  protected readonly loading = this.store.selectSignal(selectCandidatesLoading);
  protected readonly saving = this.store.selectSignal(selectCandidatesSaving);
  protected readonly error = this.store.selectSignal(selectCandidatesError);

  protected readonly allExamsMode = computed(() => !this.examId());
  protected readonly search = signal('');
  /** Exam filter, only used in all-exams mode. */
  protected readonly examFilter = signal<string>('all');
  /** Which rows have their passcode revealed. */
  protected readonly revealed = signal<ReadonlySet<string>>(new Set());

  protected readonly rows = computed<CandidateRow[]>(() => {
    const dict = this.examDict();
    const examId = this.examId();
    const examFilter = this.examFilter();
    return this.candidates()
      .filter((c) =>
        examId ? c.exam_id === examId : examFilter === 'all' || c.exam_id === examFilter,
      )
      .map((c) => ({
        ...c,
        examTitle: dict[c.exam_id]?.title ?? 'Unknown exam',
        status: c.has_attempted ? 'attempted' : 'not-started',
      }));
  });

  protected readonly stats = computed(() => {
    const rows = this.rows();
    const attempted = rows.filter((r) => r.has_attempted).length;
    return { total: rows.length, attempted, notStarted: rows.length - attempted };
  });

  protected readonly displayedColumns = computed(() =>
    this.allExamsMode()
      ? ['name', 'username', 'passcode', 'exam', 'status', 'actions']
      : ['name', 'username', 'passcode', 'status', 'actions'],
  );

  protected readonly dataSource = new MatTableDataSource<CandidateRow>([]);

  constructor() {
    // Search across the visible text columns.
    this.dataSource.filterPredicate = (row, term) =>
      [row.name, row.username, row.examTitle].some((v) => v.toLowerCase().includes(term));

    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.filter = this.search().trim().toLowerCase();
      this.dataSource.paginator?.firstPage();
    });
  }

  ngOnInit(): void {
    this.reload();
    // Exam titles are needed for the exam column / filter.
    if (this.allExamsMode() && this.exams().length === 0) {
      this.store.dispatch(AdminExamsActions.loadExams());
    }
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.paginator = this.paginator() ?? null;
  }

  protected reload(): void {
    this.store.dispatch(AdminExamsActions.loadCandidates({ examId: this.examId() }));
  }

  private takenUsernames(): ReadonlySet<string> {
    return new Set(this.candidates().map((c) => c.username));
  }

  protected openAdd(): void {
    const examId = this.examId();
    if (!examId) return;
    this.dialog.open<AddCandidateDialogComponent, AddCandidateDialogData>(
      AddCandidateDialogComponent,
      {
        data: { examId, takenUsernames: this.takenUsernames() },
        width: '480px',
        maxWidth: '94vw',
      },
    );
  }

  protected openImport(): void {
    const examId = this.examId();
    if (!examId) return;
    this.dialog.open<ImportCandidatesDialogComponent, ImportCandidatesDialogData>(
      ImportCandidatesDialogComponent,
      {
        data: { examId, takenUsernames: this.takenUsernames() },
        width: '720px',
        maxWidth: '94vw',
      },
    );
  }

  protected toggleReveal(id: string): void {
    const next = new Set(this.revealed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.revealed.set(next);
  }

  protected copyCredentials(c: CandidateRow): void {
    const ok = this.clipboard.copy(
      `Exam: ${c.examTitle}\nUsername: ${c.username}\nPasscode: ${c.passcode}`,
    );
    if (ok) this.notify.success(`Login details for ${c.name} copied`);
    else this.notify.error("Couldn't copy to the clipboard");
  }

  protected resetAttempt(c: CandidateRow): void {
    this.confirm
      .ask({
        title: 'Reset attempt?',
        message: `${c.name} will be able to take "${c.examTitle}" again. Their previous result is kept.`,
        confirmText: 'Reset attempt',
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.store.dispatch(AdminExamsActions.resetCandidateAttempt({ id: c.id })));
  }

  protected remove(c: CandidateRow): void {
    this.confirm
      .ask({
        title: 'Remove candidate?',
        message: `${c.name} (${c.username}) will no longer be able to log in. This can't be undone.`,
        confirmText: 'Remove',
        destructive: true,
      })
      .pipe(filter(Boolean))
      .subscribe(() => this.store.dispatch(AdminExamsActions.deleteCandidate({ id: c.id })));
  }

  /** Exports what's currently shown (after search/filter), including passcodes. */
  protected exportCsv(): void {
    const rows = this.dataSource.filteredData;
    const csv = toCsv(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Username', value: (r) => r.username },
      { header: 'Passcode', value: (r) => r.passcode },
      { header: 'Exam', value: (r) => r.examTitle },
      { header: 'Status', value: (r) => (r.has_attempted ? 'Attempted' : 'Not started') },
    ]);
    const exam = this.examId() ? this.examDict()[this.examId()!]?.title : 'all-exams';
    downloadCsv(`candidates-${slugify(exam ?? 'exam')}.csv`, csv);
  }
}
