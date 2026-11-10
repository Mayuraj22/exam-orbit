import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectIsAuthenticated } from '../../features/auth/store/auth.selectors';
import { first, map } from 'rxjs/operators';

export const candidateGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);

  return store.select(selectIsAuthenticated).pipe(
    first(),
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        return router.createUrlTree(['/candidate/login']);
      }
      return true;
    }),
  );
};
