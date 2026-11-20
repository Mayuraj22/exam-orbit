import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Minimal frame for candidates: brand bar + centred content, no admin navigation. */
@Component({
  selector: 'app-candidate-layout',
  imports: [RouterOutlet, MatIconModule],
  template: `
    <header class="bar">
      <span class="brand"
        ><span class="logo" aria-hidden="true"><mat-icon>public</mat-icon></span> ExamOrbit</span
      >
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
      gap: 10px;
      font:
        600 17px / 1 Inter,
        Roboto,
        sans-serif;
      color: var(--mat-sys-on-surface);
    }
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: #4338ca;
      color: #ffffff;
    }
    .logo mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
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
