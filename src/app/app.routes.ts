import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./core/pages/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page not found · ExamOrbit',
  },
];
