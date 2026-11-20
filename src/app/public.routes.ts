import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { candidateAuthFeature } from './features/auth/store/auth.reducer';
import { candidateAuthEffects } from './features/auth/store/auth.effects';
import { OUTLINED_FORM_FIELDS } from './shared/form-field-defaults';

/**
 * Public area: the landing page (both sign-ins) and the candidate pages.
 * The candidate store slice lives here so the landing page's candidate form and
 * /exam/... share one instance (registering the effects twice would run them twice).
 */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideState(candidateAuthFeature),
      provideEffects(candidateAuthEffects),
      OUTLINED_FORM_FIELDS,
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./core/pages/landing/landing.component').then((m) => m.LandingComponent),
        title: 'ExamOrbit · Sign in',
      },
      {
        path: 'exam',
        loadChildren: () =>
          import('./features/candidate/candidate.routes').then((m) => m.CANDIDATE_ROUTES),
      },
    ],
  },
];
