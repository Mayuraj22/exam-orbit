import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Minimal frame for candidates: brand bar + centred content, no admin navigation. */
@Component({
  selector: 'app-candidate-layout',
  imports: [RouterOutlet, MatIconModule],
  template: `
    <header class="bar">
      <span class="brand"><mat-icon aria-hidden="true">public</mat-icon> ExamOrbit</span>
    </header>
    <main class="content">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .bar {
      display: flex;
      align-items: center;
      height: 56px;
      padding: 0 20px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-primary);
    }
    .content {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 40px 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateLayoutComponent {}
