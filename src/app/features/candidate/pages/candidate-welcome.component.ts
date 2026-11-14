import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { CandidateAuthActions } from '../../auth/store/auth.actions';
import { selectCandidateSession } from '../../auth/store/auth.selectors';

/** /exam/welcome: exam details, rules and (when the webcam is required) consent. */
@Component({
  selector: 'app-candidate-welcome',
  imports: [MatButtonModule, MatCheckboxModule, MatIconModule],
  templateUrl: './candidate-welcome.component.html',
  styleUrl: './candidate-welcome.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateWelcomeComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly session = this.store.selectSignal(selectCandidateSession);
  protected readonly exam = computed(() => this.session()?.exam ?? null);
  protected readonly firstName = computed(() => this.session()?.candidate.name.split(' ')[0] ?? '');

  protected readonly consented = signal(false);
  protected readonly showConsentError = signal(false);

  /** The rules list, built from this exam's settings. */
  protected readonly rules = computed(() => {
    const exam = this.exam();
    if (!exam) return [];
    const rules = [
      'You have one attempt. Once you start, the timer runs until you submit or time is up.',
      'Your answers are saved as you go. When time runs out, the exam is submitted automatically.',
      'Stay on this page: switching tabs or windows is recorded.',
    ];
    if (exam.camera_required) {
      const warnings = exam.max_warnings;
      rules.push(
        'Your webcam must stay on. Photos are taken during the exam and reviewed by your exam admin.',
        warnings === 0
          ? 'Any rule break (face not visible, another person, leaving the page) submits your exam immediately.'
          : `After ${warnings} warning${warnings === 1 ? '' : 's'} for rule breaks (face not visible, another person, leaving the page), the next one submits your exam automatically.`,
      );
    }
    return rules;
  });

  protected start(): void {
    if (this.exam()?.camera_required && !this.consented()) {
      this.showConsentError.set(true);
      return;
    }
    this.router.navigateByUrl(this.exam()?.camera_required ? '/exam/check' : '/exam/take');
  }

  protected signOut(): void {
    this.store.dispatch(CandidateAuthActions.logout());
  }
}
