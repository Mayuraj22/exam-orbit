import { Routes } from '@angular/router';
import { toLanding } from '../../core/guards/to-landing';
import { candidateGuard } from '../../core/guards/candidate.guard';
import { ProctoringService } from './exam/proctoring.service';

/** Candidate area (/exam/...): no admin shell; its own store slice. */
export const CANDIDATE_ROUTES: Routes = [
  {
    path: '',
    providers: [
      // One instance for the whole sitting: the camera stays on from the check into the exam.
      ProctoringService,
    ],
    loadComponent: () =>
      import('./candidate-layout.component').then((m) => m.CandidateLayoutComponent),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      // Sign-in lives on the landing page now.
      { path: 'login', redirectTo: toLanding('candidate') },
      {
        path: 'home',
        canActivate: [candidateGuard],
        loadComponent: () =>
          import('./pages/candidate-home.component').then((m) => m.CandidateHomeComponent),
        title: 'My exams · ExamOrbit',
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
