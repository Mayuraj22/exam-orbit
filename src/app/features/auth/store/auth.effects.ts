import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, filter, from, map, of, switchMap, tap } from 'rxjs';
import { CandidateAuthActions } from './auth.actions';
import { CandidateSessionService } from '../candidate-session.service';

const SERVER_ERROR = "Couldn't reach the exam server. Check your connection and try again.";

/** exhaustMap: ignore extra clicks on "Continue" while a login is in flight. */
export const login$ = createEffect(
  (actions$ = inject(Actions), sessions = inject(CandidateSessionService)) =>
    actions$.pipe(
      ofType(CandidateAuthActions.login),
      exhaustMap(({ username, passcode }) =>
        from(sessions.login(username, passcode)).pipe(
          map((result) => CandidateAuthActions.loginResult({ result })),
          catchError(() => of(CandidateAuthActions.loginFailure({ error: SERVER_ERROR }))),
        ),
      ),
    ),
  { functional: true },
);

export const restoreSession$ = createEffect(
  (actions$ = inject(Actions), sessions = inject(CandidateSessionService)) =>
    actions$.pipe(
      ofType(CandidateAuthActions.restoreSession),
      switchMap(() =>
        from(sessions.restore()).pipe(
          map((result) => CandidateAuthActions.restoreSessionResult({ result })),
          catchError(() => of(CandidateAuthActions.loginFailure({ error: SERVER_ERROR }))),
        ),
      ),
    ),
  { functional: true },
);

/** A successful login goes straight to the instructions page. */
export const loginRedirect$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(CandidateAuthActions.loginResult),
      filter(({ result }) => result.status === 'ok'),
      tap(() => router.navigateByUrl('/exam/welcome')),
    ),
  { functional: true, dispatch: false },
);

export const logout$ = createEffect(
  (
    actions$ = inject(Actions),
    sessions = inject(CandidateSessionService),
    router = inject(Router),
  ) =>
    actions$.pipe(
      ofType(CandidateAuthActions.logout),
      exhaustMap(() => from(sessions.logout().catch(() => undefined))),
      tap(() => router.navigateByUrl('/exam/login')),
    ),
  { functional: true, dispatch: false },
);

export const candidateAuthEffects = { login$, restoreSession$, loginRedirect$, logout$ };
