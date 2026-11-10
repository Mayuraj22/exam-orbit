import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import { selectCandidatesSaving } from '../../store/exams.selectors';
import { downloadCsv, parseCsv } from '../../../../shared/utils/csv';
import {
  generatePasscode,
  generateUsername,
  USERNAME_PATTERN,
} from '../../../../shared/utils/credentials';

export interface ImportCandidatesDialogData {
  examId: string;
  takenUsernames: ReadonlySet<string>;
}

interface PreviewRow {
  line: number;
  name: string;
  username: string;
  passcode: string;
  error: string | null;
}

const MAX_ROWS = 500;

/**
 * Import candidates from a CSV with a `name` column and optional `username`.
 * Shows a preview with per-row validation; only valid rows are imported.
 */
@Component({
  selector: 'app-import-candidates-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './import-candidates-dialog.component.html',
  styleUrl: './import-candidates-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportCandidatesDialogComponent {
  private readonly data = inject<ImportCandidatesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ImportCandidatesDialogComponent>);
  private readonly store = inject(Store);
  protected readonly saving = this.store.selectSignal(selectCandidatesSaving);

  protected readonly fileName = signal<string | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly rows = signal<PreviewRow[]>([]);
  protected readonly validRows = computed(() => this.rows().filter((r) => !r.error));
  protected readonly invalidCount = computed(() => this.rows().length - this.validRows().length);

  constructor() {
    inject(Actions)
      .pipe(ofType(AdminExamsActions.createCandidatesSuccess), takeUntilDestroyed())
      .subscribe(() => this.dialogRef.close(true));
  }

  protected downloadTemplate(): void {
    downloadCsv(
      'candidates-template.csv',
      'name,username\r\nPriya Sharma,priya.sharma\r\nAlex Chen,\r\n',
    );
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow choosing the same file again
    if (!file) return;

    this.fileName.set(file.name);
    this.fileError.set(null);
    this.rows.set([]);

    if (file.size > 1_000_000) {
      this.fileError.set('That file is larger than 1 MB. Split it into smaller files.');
      return;
    }

    try {
      this.rows.set(this.buildPreview(parseCsv(await file.text())));
    } catch {
      this.fileError.set("Couldn't read that file. Make sure it's a .csv file.");
    }
  }

  private buildPreview(table: string[][]): PreviewRow[] {
    if (table.length === 0) {
      this.fileError.set('The file is empty.');
      return [];
    }

    const header = table[0].map((h) => h.trim().toLowerCase());
    const nameCol = header.indexOf('name');
    const userCol = header.indexOf('username');
    if (nameCol === -1) {
      this.fileError.set(
        'The first row must be a header with a "name" column (and optionally "username").',
      );
      return [];
    }

    const body = table.slice(1);
    if (body.length > MAX_ROWS) {
      this.fileError.set(
        `At most ${MAX_ROWS} candidates per import. This file has ${body.length}.`,
      );
      return [];
    }

    // Track usernames as we go so duplicates inside the file are caught too.
    const taken = new Set(this.data.takenUsernames);
    return body.map((cells, i) => {
      const name = (cells[nameCol] ?? '').trim();
      let username = (userCol >= 0 ? (cells[userCol] ?? '') : '').trim().toLowerCase();
      let error: string | null = null;

      if (!name) error = 'Name is missing';
      else if (name.length > 120) error = 'Name is too long';

      if (!error) {
        if (!username) username = generateUsername(name, taken);
        else if (!USERNAME_PATTERN.test(username)) error = 'Invalid username';
        else if (taken.has(username)) error = 'Username already used';
      }
      if (!error) taken.add(username);

      return { line: i + 2, name, username, passcode: error ? '' : generatePasscode(), error };
    });
  }

  protected import(): void {
    const candidates = this.validRows().map((r) => ({
      exam_id: this.data.examId,
      name: r.name,
      username: r.username,
      passcode: r.passcode,
      has_attempted: false,
    }));
    if (candidates.length) this.store.dispatch(AdminExamsActions.createCandidates({ candidates }));
  }
}
