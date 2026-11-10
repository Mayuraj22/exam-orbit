import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** App-wide toasts. Use this instead of calling MatSnackBar directly. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, undefined, {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  /** Errors stay longer and need a click to dismiss. */
  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 8000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
      panelClass: 'snackbar-error',
      politeness: 'assertive',
    });
  }
}
