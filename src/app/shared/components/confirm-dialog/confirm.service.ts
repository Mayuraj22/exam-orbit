import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/**
 * Replacement for window.confirm():
 *   this.confirm.ask({ title, message, destructive: true })
 *     .pipe(filter(Boolean))
 *     .subscribe(() => ...);
 * Emits true only when the user clicks the confirm button.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  ask(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data,
        width: '420px',
        maxWidth: '92vw',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
