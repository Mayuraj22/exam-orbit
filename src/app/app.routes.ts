import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { toLanding } from './core/guards/to-landing';

export const routes: Routes = [
  // Old admin sign-in URL: the landing page has both sign-ins now.
  { path: 'login', redirectTo: toLanding('admin') },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./core/layout/shell/shell.component').then((m) => m.ShellComponent),
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadChildren: () => import('./public.routes').then((m) => m.PUBLIC_ROUTES),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/pages/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page not found · ExamOrbit',
  },
];
