import { ErrorHandler, inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Catches errors nothing else handled (bugs, failed lazy-chunk loads…):
 * logs them as before and tells the user with a toast instead of failing silently.
 * Toasts are throttled so an error loop can't flood the screen.
 */
@Injectable()
export class GlobalErrorHandler extends ErrorHandler {
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private lastToast = 0;

  override handleError(error: unknown): void {
    super.handleError(error); // keeps the console output

    if (!this.isBrowser) return;
    const now = Date.now();
    if (now - this.lastToast < 5000) return;
    this.lastToast = now;

    const chunkFailed = /Loading chunk|Failed to fetch dynamically imported module/i.test(
      String(error),
    );
    const message = chunkFailed
      ? 'The app was updated. Please refresh the page.'
      : 'Something went wrong. If it keeps happening, refresh the page.';

    // Loaded on demand so the snackbar/overlay code stays out of the first download.
    import('./services/notification.service')
      .then(({ NotificationService }) => this.injector.get(NotificationService).error(message))
      .catch(() => {
        /* nothing more we can do */
      });
  }
}
