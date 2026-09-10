import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/components/exam-list/exam-list.component').then(m => m.ExamListComponent),
  },
];
