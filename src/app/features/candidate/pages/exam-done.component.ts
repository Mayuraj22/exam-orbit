import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** /exam/done?reason=submitted|terminated|time_up */
@Component({
  selector: 'app-exam-done',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="auth-card blocked" role="status">
      <mat-icon class="blocked-icon" [class.bad]="reason() === 'terminated'" aria-hidden="true">
        {{ content().icon }}
      </mat-icon>
      <h1>{{ content().title }}</h1>
      <p class="sub">{{ content().message }}</p>
      <a mat-stroked-button routerLink="/exam/login">Done</a>
    </div>
  `,
  styleUrls: ['../../../shared/styles/auth-page.scss', './candidate-pages.scss'],
  styles: `
    .bad {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamDoneComponent {
  /** ?reason= query param. */
  readonly reason = input<string>();

  protected readonly content = computed(() => {
    switch (this.reason()) {
      case 'terminated':
        return {
          icon: 'gpp_bad',
          title: 'Your exam was ended',
          message:
            'There were too many rule breaks, so your answers were submitted automatically. Your exam admin will review what happened.',
        };
      case 'time_up':
        return {
          icon: 'timer_off',
          title: "Time's up",
          message:
            'Your answers were saved and submitted automatically. You can close this window.',
        };
      default:
        return {
          icon: 'task_alt',
          title: 'Exam submitted',
          message: 'Thank you. Your answers have been received. You can close this window.',
        };
    }
  });
}
