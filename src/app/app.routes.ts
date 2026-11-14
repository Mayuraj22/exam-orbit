import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./core/pages/admin-login.component').then((m) => m.AdminLoginComponent),
    title: 'Sign in · ExamOrbit',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./core/layout/shell/shell.component').then((m) => m.ShellComponent),
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'exam',
    loadChildren: () =>
      import('./features/candidate/candidate.routes').then((m) => m.CANDIDATE_ROUTES),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/pages/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page not found · ExamOrbit',
  },
];
