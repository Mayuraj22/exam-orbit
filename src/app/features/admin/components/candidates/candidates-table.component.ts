import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { initials } from '../../../../shared/utils/relative-date';
import { filter, take, takeUntil } from 'rxjs';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectCandidates,
  selectCandidatesError,
  selectCandidatesLoading,
  selectCandidatesSaving,
  selectExamDictionary,
  selectExams,
} from '../../store/exams.selectors';
import { assignmentFor, Candidate } from '../../../../shared/models/candidate.model';
import { ConfirmService } from '../../../../shared/components/confirm-dialog/confirm.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { downloadCsv, slugify, toCsv } from '../../../../shared/utils/csv';
import { generatePasscode } from '../../../../shared/utils/credentials';
import {
  AddCandidateDialogComponent,
  AddCandidateDialogData,
} from './add-candidate-dialog.component';
import {
  ImportCandidatesDialogComponent,
  ImportCandidatesDialogData,
} from './import-candidates-dialog.component';
import {
  Credential,
  CredentialsDialogComponent,
  CredentialsDialogData,
} from './credentials-dialog.component';
import { AssignExamsDialogComponent, AssignExamsDialogData } from './assign-exams-dialog.component';
import {
  AssignExistingDialogComponent,
  AssignExistingDialogData,
} from './assign-existing-dialog.component';

/** Exam filter on the all-candidates page. */
type ExamFilter = 'all' | 'unassigned' | string;

interface AssignedExam {
  examId: string;
  title: string;
  attempted: boolean;
}

interface CandidateRow extends Candidate {
  exams: AssignedExam[];
  /** In an exam's tab: this exam's status. */
  attempted: boolean;
}

/**
 * Candidates table with multi-select and bulk actions.
 * - Without `examId` (Candidates page): every person and the exams assigned to them.
 * - With `examId` (exam's Candidates tab): only people assigned to that exam.
 */
@Component({
  selector: 'app-candidates-table',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
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
  protected readonly initials = initials;
  /** Limit to one exam's candidates; omit for everyone. */
  readonly examId = input<string>();

  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly clipboard = inject(Clipboard);
  private readonly notify = inject(NotificationService);
  private readonly actions$ = inject(Actions);

  protected readonly loginUrl = `${inject(DOCUMENT).location.origin}/exam/login`;

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  private readonly candidates = this.store.selectSignal(selectCandidates);
  private readonly examDict = this.store.selectSignal(selectExamDictionary);
  protected readonly exams = this.store.selectSignal(selectExams);
  protected readonly loading = this.store.selectSignal(selectCandidatesLoading);
  protected readonly saving = this.store.selectSignal(selectCandidatesSaving);
  protected readonly error = this.store.selectSignal(selectCandidatesError);

  protected readonly examMode = computed(() => !!this.examId());
  protected readonly search = signal('');
  protected readonly examFilter = signal<ExamFilter>('all');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly rows = computed<CandidateRow[]>(() => {
    const dict = this.examDict();
    const examId = this.examId();
    const examFilter = this.examFilter();
    return this.candidates()
      .filter((c) => {
        if (examId) return !!assignmentFor(c, examId);
        if (examFilter === 'unassigned') return c.assignments.length === 0;
        if (examFilter !== 'all') return !!assignmentFor(c, examFilter);
        return true;
      })
      .map((c) => ({
        ...c,
        exams: c.assignments
          .map((a) => ({
            examId: a.exam_id,
            title: dict[a.exam_id]?.title ?? 'Unknown exam',
            attempted: a.has_attempted,
          }))
          .sort((a, b) => a.title.localeCompare(b.title)),
        attempted: examId ? !!assignmentFor(c, examId)?.has_attempted : false,
      }));
  });

  protected readonly stats = computed(() => {
    const rows = this.rows();
    if (this.examMode()) {
      const attempted = rows.filter((r) => r.attempted).length;
      return [
        { label: 'assigned', value: rows.length },
        { label: 'attempted', value: attempted },
        { label: 'not started', value: rows.length - attempted },
      ];
    }
    return [
      { label: 'candidates', value: rows.length },
      { label: 'without an exam', value: rows.filter((r) => !r.exams.length).length },
    ];
  });

  protected readonly displayedColumns = computed(() =>
    this.examMode()
      ? ['select', 'name', 'username', 'status', 'actions']
      : ['select', 'name', 'username', 'exams', 'actions'],
  );

  protected readonly dataSource = new MatTableDataSource<CandidateRow>([]);

  /** Selected candidates that are still in the current (filtered) list. */
  protected readonly selectedRows = computed(() =>
    this.rows().filter((r) => this.selected().has(r.id)),
  );
  private readonly visibleIds = signal<string[]>([]);
  protected readonly allVisibleSelected = computed(
    () => this.visibleIds().length > 0 && this.visibleIds().every((id) => this.selected().has(id)),
  );
  protected readonly someVisibleSelected = computed(
    () => !this.allVisibleSelected() && this.visibleIds().some((id) => this.selected().has(id)),
  );

  constructor() {
    this.dataSource.filterPredicate = (row, term) =>
      [row.name, row.username, row.email ?? ''].some((v) => v.toLowerCase().includes(term));

    effect(() => {
      this.dataSource.data = this.rows();
      this.visibleIds.set(this.dataSource.filteredData.map((r) => r.id));
    });
    effect(() => {
      this.dataSource.filter = this.search().trim().toLowerCase();
      this.dataSource.paginator?.firstPage();
      this.visibleIds.set(this.dataSource.filteredData.map((r) => r.id));
    });
    // Forget selections of people no longer in the list (deleted, filtered by exam…).
    effect(() => {
      const ids = new Set(this.rows().map((r) => r.id));
      const current = this.selected();
      if ([...current].some((id) => !ids.has(id))) {
        this.selected.set(new Set([...current].filter((id) => ids.has(id))));
      }
    });
  }

  ngOnInit(): void {
    this.reload();
    if (this.exams().length === 0) this.store.dispatch(AdminExamsActions.loadExams());
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.paginator = this.paginator() ?? null;
  }

  protected reload(): void {
    this.store.dispatch(AdminExamsActions.loadCandidates());
  }

  // --- Selection ---------------------------------------------------------------

  protected toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  /** Selects every candidate matching the current search and filters (all pages). */
  protected toggleAllVisible(): void {
    const next = new Set(this.selected());
    const all = this.allVisibleSelected();
    for (const id of this.visibleIds()) {
      if (all) next.delete(id);
      else next.add(id);
    }
    this.selected.set(next);
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  private takenUsernames(): ReadonlySet<string> {
    return new Set(this.candidates().map((c) => c.username));
  }

  private examTitle(examId: string | undefined): string {
    return (examId && this.examDict()[examId]?.title) || 'your exams';
  }

  // --- Adding ------------------------------------------------------------------

  protected openAdd(): void {
    const examId = this.examId();
    this.dialog
      .open<AddCandidateDialogComponent, AddCandidateDialogData, Credential>(
        AddCandidateDialogComponent,
        {
          data: { examIds: examId ? [examId] : [], takenUsernames: this.takenUsernames() },
          width: '520px',
          maxWidth: '94vw',
        },
      )
      .afterClosed()
      .subscribe((created) => {
        if (created) this.showCredentials('Candidate added', [created]);
      });
  }

  protected openImport(): void {
    const examId = this.examId();
    this.dialog
      .open<ImportCandidatesDialogComponent, ImportCandidatesDialogData, Credential[]>(
        ImportCandidatesDialogComponent,
        {
          data: { examIds: examId ? [examId] : [], takenUsernames: this.takenUsernames() },
          width: '760px',
          maxWidth: '94vw',
        },
      )
      .afterClosed()
      .subscribe((created) => {
        if (created?.length) this.showCredentials(`${created.length} candidates imported`, created);
      });
  }

  /** Exam tab: pick people who already exist. */
  protected openAssignExisting(): void {
    const examId = this.examId();
    if (!examId) return;
    this.dialog.open<AssignExistingDialogComponent, AssignExistingDialogData>(
      AssignExistingDialogComponent,
      { data: { examId, examTitle: this.examTitle(examId) }, width: '560px', maxWidth: '94vw' },
    );
  }

  /** The one and only time new passcodes are shown. */
  private showCredentials(title: string, credentials: Credential[]): void {
    this.dialog.open<CredentialsDialogComponent, CredentialsDialogData>(
      CredentialsDialogComponent,
      {
        data: { title, credentials, examTitle: this.examTitle(this.examId()) },
        width: '640px',
        maxWidth: '94vw',
      },
    );
  }

  // --- Bulk and row actions ----------------------------------------------------

  protected assignExams(ids: string[]): void {
    this.dialog.open<AssignExamsDialogComponent, AssignExamsDialogData>(
      AssignExamsDialogComponent,
      {
        data: { candidateIds: ids },
        width: '480px',
        maxWidth: '94vw',
      },
    );
  }

  protected removeFromExam(rows: CandidateRow[]): void {
    const examId = this.examId();
    if (!examId || !rows.length) return;
    const who = rows.length === 1 ? rows[0].name : `${rows.length} candidates`;
    this.confirm
      .ask({
        title: 'Remove from this exam?',
        message: `${who} will no longer see "${this.examTitle(examId)}". Results already submitted are kept. They stay on the Candidates page.`,
        confirmText: 'Remove from exam',
      })
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.store.dispatch(
          AdminExamsActions.unassignCandidates({ candidateIds: rows.map((r) => r.id), examId }),
        );
        this.clearSelection();
      });
  }

  protected resetPasscodes(rows: CandidateRow[]): void {
    if (!rows.length) return;
    const who = rows.length === 1 ? `${rows[0].name}'s passcode` : `${rows.length} passcodes`;
    this.confirm
      .ask({
        title: rows.length === 1 ? 'Reset passcode?' : 'Reset passcodes?',
        message: `${who} will stop working. You'll see the new ${rows.length === 1 ? 'one' : 'ones'} once and need to send ${rows.length === 1 ? 'it' : 'them'} out.`,
        confirmText: 'Reset',
      })
      .pipe(filter(Boolean))
      .subscribe(() => {
        const items = rows.map((r) => ({ id: r.id, passcode: generatePasscode() }));
        this.actions$
          .pipe(
            ofType(AdminExamsActions.resetCandidatePasscodesSuccess),
            take(1),
            takeUntil(this.actions$.pipe(ofType(AdminExamsActions.resetCandidatePasscodesFailure))),
          )
          .subscribe(() =>
            this.showCredentials(
              rows.length === 1 ? 'New passcode' : `${rows.length} new passcodes`,
              rows.map((r, i) => ({
                name: r.name,
                username: r.username,
                passcode: items[i].passcode,
              })),
            ),
          );
        this.store.dispatch(AdminExamsActions.resetCandidatePasscodes({ items }));
      });
  }

  protected resetAttempt(row: CandidateRow): void {
    const examId = this.examId();
    if (!examId) return;
    this.confirm
      .ask({
        title: 'Reset attempt?',
        message: `${row.name} will be able to take "${this.examTitle(examId)}" again. Their previous result is kept.`,
        confirmText: 'Reset attempt',
      })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.store.dispatch(AdminExamsActions.resetCandidateAttempt({ id: row.id, examId })),
      );
  }

  protected deleteCandidates(rows: CandidateRow[]): void {
    if (!rows.length) return;
    const who =
      rows.length === 1 ? `${rows[0].name} (${rows[0].username})` : `${rows.length} candidates`;
    this.confirm
      .ask({
        title: rows.length === 1 ? 'Delete candidate?' : `Delete ${rows.length} candidates?`,
        message: `${who} will be removed from every exam and can no longer sign in. Their results are deleted too. This can't be undone.`,
        confirmText: 'Delete',
        destructive: true,
      })
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.store.dispatch(AdminExamsActions.deleteCandidates({ ids: rows.map((r) => r.id) }));
        this.clearSelection();
      });
  }

  /** Sign-in details without the passcode (stored hashed, can't be shown). */
  protected copyCredentials(c: CandidateRow): void {
    const ok = this.clipboard.copy(
      [
        `Sign in at: ${this.loginUrl}`,
        `Username: ${c.username}`,
        'Passcode: sent separately',
        c.exams.length ? `Exams: ${c.exams.map((e) => e.title).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    if (ok) this.notify.success(`Sign-in details for ${c.name} copied (without passcode)`);
    else this.notify.error("Couldn't copy to the clipboard");
  }

  /** Exports the selected candidates, or everyone shown if none are selected. */
  protected exportCsv(): void {
    const rows = this.selectedRows().length ? this.selectedRows() : this.dataSource.filteredData;
    const csv = toCsv(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Username', value: (r) => r.username },
      { header: 'Email', value: (r) => r.email ?? '' },
      {
        header: 'Exams',
        value: (r) =>
          r.exams.map((e) => `${e.title}${e.attempted ? ' (attempted)' : ''}`).join('; '),
      },
    ]);
    downloadCsv(
      `candidates-${slugify(this.examId() ? this.examTitle(this.examId()) : 'all')}.csv`,
      csv,
    );
  }
}
