import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { downloadCsv, slugify, toCsv } from '../../../../shared/utils/csv';

export interface Credential {
  name: string;
  username: string;
  passcode: string;
}

export interface CredentialsDialogData {
  title: string;
  examTitle: string;
  credentials: Credential[];
}

/**
 * Shows new passcodes ONCE (after add, import or reset). They're stored hashed,
 * so this is the only chance to copy or download them. Closing asks for
 * confirmation unless something was copied or downloaded.
 */
@Component({
  selector: 'app-credentials-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './credentials-dialog.component.html',
  styleUrl: './credentials-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialsDialogComponent {
  protected readonly data = inject<CredentialsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CredentialsDialogComponent>);
  private readonly clipboard = inject(Clipboard);

  protected readonly loginUrl = `${inject(DOCUMENT).location.origin}/exam/login`;
  /** Something was copied or downloaded, so it's safe to close. */
  protected readonly saved = signal(false);
  protected readonly confirmingClose = signal(false);
  protected readonly copiedIndex = signal<number | 'all' | null>(null);

  constructor() {
    this.dialogRef.disableClose = true; // Esc / backdrop must not lose the passcodes silently
  }

  private message(c: Credential): string {
    return [
      `Exam: ${this.data.examTitle}`,
      `Sign in at: ${this.loginUrl}`,
      `Username: ${c.username}`,
      `Passcode: ${c.passcode}`,
    ].join('\n');
  }

  protected copyOne(c: Credential, index: number): void {
    if (this.clipboard.copy(this.message(c))) this.markCopied(index);
  }

  protected copyAll(): void {
    const text = this.data.credentials.map((c) => `${c.name}\n${this.message(c)}`).join('\n\n');
    if (this.clipboard.copy(text)) this.markCopied('all');
  }

  protected download(): void {
    const csv = toCsv(this.data.credentials, [
      { header: 'Name', value: (c) => c.name },
      { header: 'Username', value: (c) => c.username },
      { header: 'Passcode', value: (c) => c.passcode },
      { header: 'Exam', value: () => this.data.examTitle },
      { header: 'Sign in at', value: () => this.loginUrl },
    ]);
    downloadCsv(`credentials-${slugify(this.data.examTitle)}.csv`, csv);
    this.saved.set(true);
  }

  protected close(): void {
    if (this.saved() || this.confirmingClose()) this.dialogRef.close();
    else this.confirmingClose.set(true);
  }

  private markCopied(which: number | 'all'): void {
    this.saved.set(true);
    this.copiedIndex.set(which);
    setTimeout(() => {
      if (this.copiedIndex() === which) this.copiedIndex.set(null);
    }, 2000);
  }
}
