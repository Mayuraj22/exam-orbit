import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="page">
      <div class="empty-state not-found">
        <mat-icon>explore_off</mat-icon>
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist or has moved.</p>
        <div class="actions">
          <a mat-flat-button routerLink="/admin">Go to dashboard</a>
          <a mat-button routerLink="/admin/exams">View exams</a>
        </div>
      </div>
    </div>
  `,
  styles: `
    .not-found {
      padding-top: 15vh;
    }
    .not-found mat-icon {
      width: 64px;
      height: 64px;
      font-size: 64px;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      color: var(--mat-sys-on-surface);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
