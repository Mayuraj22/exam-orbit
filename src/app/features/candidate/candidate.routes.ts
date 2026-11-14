import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { candidateAuthFeature } from '../auth/store/auth.reducer';
import { candidateAuthEffects } from '../auth/store/auth.effects';
import { candidateGuard } from '../../core/guards/candidate.guard';
import { ProctoringService } from './exam/proctoring.service';

/** Candidate area (/exam/...): no admin shell; its own store slice. */
export const CANDIDATE_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideState(candidateAuthFeature),
      provideEffects(candidateAuthEffects),
      // One instance for the whole sitting: the camera stays on from the check into the exam.
      ProctoringService,
    ],
    loadComponent: () =>
      import('./candidate-layout.component').then((m) => m.CandidateLayoutComponent),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/candidate-login.component').then((m) => m.CandidateLoginComponent),
        title: 'Sign in to your exam · ExamOrbit',
      },
      {
        path: 'welcome',
        canActivate: [candidateGuard],
        loadComponent: () =>
          import('./pages/candidate-welcome.component').then((m) => m.CandidateWelcomeComponent),
        title: 'Before you start · ExamOrbit',
      },
      {
        path: 'check',
        canActivate: [candidateGuard],
        loadComponent: () =>
          import('./pages/camera-check.component').then((m) => m.CameraCheckComponent),
        title: 'Camera check · ExamOrbit',
      },
      {
        path: 'take',
        canActivate: [candidateGuard],
        loadComponent: () => import('./pages/exam-take.component').then((m) => m.ExamTakeComponent),
        title: 'Exam in progress · ExamOrbit',
      },
      {
        path: 'done',
        loadComponent: () => import('./pages/exam-done.component').then((m) => m.ExamDoneComponent),
        title: 'Exam finished · ExamOrbit',
      },
    ],
  },
];
