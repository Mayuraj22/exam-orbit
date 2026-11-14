import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ProctoringWarningData {
  message: string;
  warningNumber: number;
  maxWarnings: number;
}

/** "Warning 1 of 2" — the candidate must acknowledge it to continue. */
@Component({
  selector: 'app-proctoring-warning-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="head" mat-dialog-title>
      <mat-icon aria-hidden="true">warning</mat-icon>
      Warning {{ data.warningNumber }} of {{ data.maxWarnings }}
    </div>
    <mat-dialog-content>
      <p class="message">{{ data.message }}</p>
      <p class="consequence">
        @if (data.warningNumber >= data.maxWarnings) {
          This was your last warning. One more rule break will submit your exam automatically.
        } @else {
          After {{ data.maxWarnings }} warnings, the next rule break submits your exam
          automatically.
        }
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" [mat-dialog-close]="true" cdkFocusInitial>
        I understand, continue
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-error);
    }
    .message {
      margin: 0 0 8px;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface);
    }
    .consequence {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProctoringWarningDialogComponent {
  protected readonly data = inject<ProctoringWarningData>(MAT_DIALOG_DATA);
}
