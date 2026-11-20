import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

/** Old sign-in URLs open the landing page on the right side of the flip card. */
export const toLanding =
  (as: 'admin' | 'candidate') =>
  ({ queryParams }: { queryParams: Record<string, string> }): UrlTree =>
    inject(Router).createUrlTree(['/'], { queryParams: { ...queryParams, as } });
