import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { adminExamsFeature } from './store/exams.reducer';
import { adminExamsEffects } from './store/exams.effects';
import { adminNotificationEffects } from './store/exams.notifications.effects';

/**
 * Admin feature routes. The store slice and effects are registered here,
 * so their code (and the Supabase client) only downloads when /admin is opened.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideState(adminExamsFeature),
      provideEffects(adminExamsEffects, adminNotificationEffects),
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./components/pages/dashboard-page.component').then(
            (m) => m.DashboardPageComponent,
          ),
        title: 'Dashboard · ExamOrbit',
      },
      {
        path: 'exams',
        loadComponent: () =>
          import('./components/exam-list/exam-list.component').then((m) => m.ExamListComponent),
        title: 'Exams · ExamOrbit',
      },
      {
        path: 'exams/:id',
        loadComponent: () =>
          import('./components/exam-detail/exam-detail.component').then(
            (m) => m.ExamDetailComponent,
          ),
        title: 'Exam · ExamOrbit',
      },
      {
        path: 'candidates',
        loadComponent: () =>
          import('./components/pages/candidates-page.component').then(
            (m) => m.CandidatesPageComponent,
          ),
        title: 'Candidates · ExamOrbit',
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./components/pages/results-page.component').then((m) => m.ResultsPageComponent),
        title: 'Results · ExamOrbit',
      },
    ],
  },
];
