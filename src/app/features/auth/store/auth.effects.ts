import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { CandidateAuthActions } from './auth.actions';
import { SupabaseService } from '../../../core/services/supabase';

export const login$ = createEffect(
  () => {
    const actions$ = inject(Actions);
    const supabaseService = inject(SupabaseService);

    return actions$.pipe(
      ofType(CandidateAuthActions.login),
      switchMap(({ username, passcode }) =>
        supabaseService.verifyCandidateLogin(username, passcode).pipe(
          map((candidate) => CandidateAuthActions.loginSuccess({ candidate })),
          catchError((error) => {
            // Handle Supabase "not found" error with user-friendly message
            const errorMessage =
              error.message?.includes('not found') || error.message?.includes('PGRST116')
                ? 'Invalid username or passcode'
                : error.message || 'Login failed. Please try again.';
            return of(CandidateAuthActions.loginFailure({ error: errorMessage }));
          }),
        ),
      ),
    );
  },
  { functional: true },
);

export const candidateAuthEffects = {
  login$,
};
