import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
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
import {
  AdminAuthService,
  AdminSignInResult,
  AdminSignUpResult,
} from '../../services/admin-auth.service';
import { CandidateAuthActions } from '../../../features/auth/store/auth.actions';
import {
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectLoginStatus,
} from '../../../features/auth/store/auth.selectors';
import { CandidateSessionService } from '../../../features/auth/candidate-session.service';

type Role = 'candidate' | 'admin';

interface Step {
  icon: string;
  title: string;
  text: string;
}

const STEPS: Record<Role, Step[]> = {
  candidate: [
    {
      icon: 'key',
      title: 'Sign in',
      text: 'Use the username and passcode your exam admin sent you.',
    },
    {
      icon: 'videocam',
      title: 'Check your camera',
      text: 'Sit in good light, alone, with your whole face in view.',
    },
    {
      icon: 'fullscreen',
      title: 'Stay on the exam',
      text: 'Leaving the page or fullscreen counts as a warning.',
    },
    {
      icon: 'task_alt',
      title: 'Submit',
      text: 'Answers save as you go. Submit before the timer ends.',
    },
  ],
  admin: [
    {
      icon: 'edit_note',
      title: 'Build exams',
      text: 'Write questions, set the time, pass mark and webcam rules.',
    },
    {
      icon: 'group_add',
      title: 'Add candidates',
      text: 'Add people or import a CSV, then assign them to exams.',
    },
    {
      icon: 'insights',
      title: 'Watch results',
      text: 'Scores are graded on the server as candidates submit.',
    },
    {
      icon: 'policy',
      title: 'Review proctoring',
      text: 'Check webcam photos and warnings, then clear or disqualify.',
    },
  ],
};

const ADMIN_MESSAGES: Record<Exclude<AdminSignInResult, 'ok'>, string> = {
  invalid: "That email or password isn't right.",
  'not-admin': "This account doesn't have admin access.",
  error: "Couldn't sign in right now. Check your connection and try again.",
};

const SIGNUP_MESSAGES: Record<Exclude<AdminSignUpResult, 'ok' | 'confirm-email'>, string> = {
  exists: 'An account with this email already exists. Sign in instead.',
  'weak-password': 'Choose a stronger password (at least 8 characters).',
  error: "Couldn't create the account right now. Try again in a minute.",
};

/** Words the headline cycles through. */
const WORDS = ['fair', 'proctored', 'secure', 'effortless'];

/** `/`: landing page with a flip card: candidate sign-in on the front, admin on the back. */
@Component({
  selector: 'app-landing',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements OnInit {
  /** ?as=admin opens the admin side; ?returnUrl= comes from the admin guard. */
  readonly as = input<string>();
  readonly returnUrl = input<string>();

  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly sessions = inject(CandidateSessionService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly role = signal<Role>('candidate');
  protected readonly flipped = computed(() => this.role() === 'admin');
  protected readonly steps = computed(() => STEPS[this.role()]);

  protected readonly word = signal(WORDS[0]);

  // --- Candidate ------------------------------------------------------------
  protected readonly candidateLoading = this.store.selectSignal(selectAuthLoading);
  private readonly status = this.store.selectSignal(selectLoginStatus);
  private readonly serverError = this.store.selectSignal(selectAuthError);
  private readonly authenticated = this.store.selectSignal(selectIsAuthenticated);
  protected readonly showPasscode = signal(false);

  protected readonly candidateError = computed(() => {
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

  protected readonly candidateForm = this.fb.group({
    username: ['', Validators.required],
    passcode: ['', Validators.required],
  });

  // --- Admin ----------------------------------------------------------------
  protected readonly adminBusy = signal(false);
  protected readonly adminError = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  /** Admin face: sign in to an existing workspace, or create a new one. */
  protected readonly adminMode = signal<'signin' | 'signup'>('signin');
  /** After sign-up with email confirmation on. */
  protected readonly confirmSentTo = signal<string | null>(null);

  protected readonly adminForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    let i = 0;
    const timer = setInterval(() => this.word.set(WORDS[++i % WORDS.length]), 2600);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async ngOnInit(): Promise<void> {
    if (this.as() === 'admin') this.role.set('admin');

    if (this.authenticated()) {
      this.router.navigateByUrl('/exam/home');
      return;
    }
    if (this.sessions.hasSavedSession()) {
      // Refreshed mid-way: resume instead of asking for the passcode again.
      this.store.dispatch(CandidateAuthActions.restoreSession());
    }
    if (this.role() === 'admin') {
      await this.adminAuth.init();
      if (this.adminAuth.isAdmin()) this.goToAdmin();
    }
  }

  protected setRole(role: Role): void {
    this.role.set(role);
    this.router.navigate([], {
      queryParams: { as: role === 'admin' ? 'admin' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected submitCandidate(): void {
    if (this.candidateForm.invalid) {
      this.candidateForm.markAllAsTouched();
      return;
    }
    const { username, passcode } = this.candidateForm.getRawValue();
    this.store.dispatch(CandidateAuthActions.login({ username: username.trim(), passcode }));
  }

  protected setAdminMode(mode: 'signin' | 'signup'): void {
    this.adminMode.set(mode);
    this.adminError.set(null);
    this.confirmSentTo.set(null);
  }

  protected async submitAdmin(): Promise<void> {
    const signup = this.adminMode() === 'signup';
    // Old accounts may have short passwords: only sign-up enforces the length.
    if (
      this.adminForm.controls.email.invalid ||
      this.adminForm.controls.password.hasError('required') ||
      (signup && this.adminForm.controls.password.invalid)
    ) {
      this.adminForm.markAllAsTouched();
      return;
    }
    this.adminBusy.set(true);
    this.adminError.set(null);
    const { email, password } = this.adminForm.getRawValue();

    if (signup) {
      const result = await this.adminAuth.signUp(email, password);
      this.adminBusy.set(false);
      if (result === 'ok') this.router.navigateByUrl('/admin');
      else if (result === 'confirm-email') this.confirmSentTo.set(email.trim());
      else if (result === 'error' && this.adminAuth.lastError)
        this.adminError.set(`Couldn't create the account: ${this.adminAuth.lastError}`);
      else this.adminError.set(SIGNUP_MESSAGES[result]);
      return;
    }

    const result = await this.adminAuth.signIn(email, password);
    this.adminBusy.set(false);
    if (result === 'ok') this.goToAdmin();
    else this.adminError.set(ADMIN_MESSAGES[result]);
  }

  private goToAdmin(): void {
    // Only follow in-app admin paths, never an outside URL.
    const target = this.returnUrl();
    this.router.navigateByUrl(target?.startsWith('/admin') ? target : '/admin');
  }
}
