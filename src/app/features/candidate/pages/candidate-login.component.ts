import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CandidateAuthActions } from '../../auth/store/auth.actions';
import {
  selectAuthError,
  selectAuthLoading,
  selectCandidateSession,
  selectIsAuthenticated,
  selectLoginStatus,
} from '../../auth/store/auth.selectors';
import { CandidateSessionService } from '../../auth/candidate-session.service';

/** /exam/login: sign in, plus the "can't start" screens (already done, not open, locked out). */
@Component({
  selector: 'app-candidate-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './candidate-login.component.html',
  styleUrls: ['../../../shared/styles/auth-page.scss', './candidate-pages.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateLoginComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly sessions = inject(CandidateSessionService);

  protected readonly loading = this.store.selectSignal(selectAuthLoading);
  protected readonly status = this.store.selectSignal(selectLoginStatus);
  protected readonly session = this.store.selectSignal(selectCandidateSession);
  protected readonly serverError = this.store.selectSignal(selectAuthError);
  private readonly authenticated = this.store.selectSignal(selectIsAuthenticated);

  protected readonly showPasscode = signal(false);

  /** Correct details, but the exam can't be taken: show a full-card message instead of the form. */
  protected readonly blocked = computed(() => {
    const s = this.status();
    return s === 'already_attempted' || s === 'not_published' ? s : null;
  });

  protected readonly formError = computed(() => {
    switch (this.status()) {
      case 'invalid':
        return "That username or passcode isn't right. Check the details your exam admin sent you.";
      case 'too_many_attempts':
        return 'Too many wrong attempts. Wait 5 minutes, then try again.';
      case 'expired':
        return 'Your session ended. Sign in again to continue.';
      default:
        return this.serverError();
    }
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    passcode: ['', Validators.required],
  });

  ngOnInit(): void {
    if (this.authenticated()) {
      this.router.navigateByUrl('/exam/welcome');
    } else if (this.sessions.hasSavedSession()) {
      // Refreshed mid-way: resume instead of asking for the passcode again.
      this.store.dispatch(CandidateAuthActions.restoreSession());
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, passcode } = this.form.getRawValue();
    this.store.dispatch(CandidateAuthActions.login({ username: username.trim(), passcode }));
  }

  protected backToSignIn(): void {
    this.form.reset();
    this.store.dispatch(CandidateAuthActions.logout());
  }
}
