import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminAuthService, AdminSignInResult } from '../services/admin-auth.service';

const MESSAGES: Record<Exclude<AdminSignInResult, 'ok'>, string> = {
  invalid: "That email or password isn't right.",
  'not-admin': "This account doesn't have admin access.",
  error: "Couldn't sign in right now. Check your connection and try again.",
};

/** /login: admin sign-in. */
@Component({
  selector: 'app-admin-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <main class="auth-page">
      <div class="auth-card">
        <div class="brand"><mat-icon aria-hidden="true">public</mat-icon> ExamOrbit</div>
        <h1>Admin sign in</h1>
        <p class="sub">Manage exams, candidates and results.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" required />
            @if (looksLikeCandidate()) {
              <mat-error>
                This is the admin sign-in. Candidates sign in at
                <a href="/exam/login">the candidate page</a>.
              </mat-error>
            } @else {
              <mat-error>Enter your admin email.</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Password</mat-label>
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
              required
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="showPassword.set(!showPassword())"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error>Enter your password.</mat-error>
          </mat-form-field>

          @if (error(); as message) {
            <p class="form-error" role="alert">
              <mat-icon inline aria-hidden="true">error_outline</mat-icon> {{ message }}
            </p>
          }

          <button mat-flat-button type="submit" class="full-width submit" [disabled]="busy()">
            @if (busy()) {
              <mat-spinner diameter="18" />
            }
            Sign in
          </button>
        </form>

        <p class="hint">Taking an exam? <a href="/exam/login">Go to candidate sign in</a></p>
      </div>
    </main>
  `,
  styleUrl: '../../shared/styles/auth-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginComponent implements OnInit {
  /** ?returnUrl= set by the admin guard. */
  readonly returnUrl = input<string>();

  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  /** A username (no "@") was typed: probably a candidate on the wrong page. */
  protected looksLikeCandidate(): boolean {
    const value = this.form.controls.email.value.trim();
    return value.length > 0 && !value.includes('@');
  }

  async ngOnInit(): Promise<void> {
    // Already signed in? Skip the form.
    await this.auth.init();
    if (this.auth.isAdmin()) this.goBack();
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signIn(email, password);
    this.busy.set(false);

    if (result === 'ok') this.goBack();
    else this.error.set(MESSAGES[result]);
  }

  private goBack(): void {
    // Only follow in-app admin paths, never an outside URL.
    const target = this.returnUrl();
    this.router.navigateByUrl(target?.startsWith('/admin') ? target : '/admin');
  }
}
