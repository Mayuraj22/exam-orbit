import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest, filter, map, take } from 'rxjs';
import { CandidateAuthActions } from '../../features/auth/store/auth.actions';
import {
  selectAuthLoading,
  selectIsAuthenticated,
  selectSessionRestored,
} from '../../features/auth/store/auth.selectors';

/**
 * Candidate exam pages need a valid session. After a refresh the saved
 * session is re-checked with the server first; otherwise → /exam/login.
 */
export const candidateGuard: CanActivateFn = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const store = inject(Store);
  const router = inject(Router);
  const loginPage = router.createUrlTree(['/exam/login']);

  let restoreRequested = false;
  return combineLatest([
    store.select(selectIsAuthenticated),
    store.select(selectSessionRestored),
    store.select(selectAuthLoading),
  ]).pipe(
    map(([authenticated, restored, loading]) => {
      if (authenticated) return true;
      if (!restored && !loading && !restoreRequested) {
        restoreRequested = true;
        store.dispatch(CandidateAuthActions.restoreSession());
      }
      return restored && !loading ? loginPage : null; // null = still checking
    }),
    filter((decision) => decision !== null),
    take(1),
  );
};
