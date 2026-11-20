import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';

export type AdminSignInResult = 'ok' | 'invalid' | 'not-admin' | 'error';
export type AdminSignUpResult = 'ok' | 'confirm-email' | 'exists' | 'weak-password' | 'error';

/**
 * Admin sign-in with Supabase Auth (email + password).
 * Being signed in is not enough: the user must also be in `admin_users`
 * (checked with the `is_admin()` database function). The session is kept by
 * Supabase in localStorage, so admins stay signed in across refreshes.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly session = signal<Session | null>(null);
  private readonly admin = signal(false);
  private ready: Promise<void> | null = null;

  readonly email = computed(() => this.session()?.user.email ?? null);
  readonly isAdmin = this.admin.asReadonly();
  /** Supabase's message for the last failed sign-up. */
  lastError: string | null = null;

  constructor() {
    if (!this.isBrowser) return;
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (!session) this.admin.set(false);
    });
  }

  /** Resolves once the saved session (if any) has been restored and checked. */
  init(): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    this.ready ??= (async () => {
      const { data } = await this.supabase.auth.getSession();
      this.session.set(data.session);
      this.admin.set(data.session ? await this.checkAdmin() : false);
    })();
    return this.ready;
  }

  async signIn(email: string, password: string): Promise<AdminSignInResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return error.status === 400 ? 'invalid' : 'error';

    this.session.set(data.session);
    if (!(await this.checkAdmin())) {
      // Signed in, but not an admin: don't keep the session around.
      await this.supabase.auth.signOut();
      return 'not-admin';
    }
    this.admin.set(true);
    this.ready = Promise.resolve();
    return 'ok';
  }

  /**
   * Creates an admin account with its own empty workspace (a database trigger
   * makes every new account an admin). When email confirmation is on, there is
   * no session yet: the user must click the link in the email first.
   */
  async signUp(email: string, password: string): Promise<AdminSignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${location.origin}/?as=admin` },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) return 'exists';
      if (/password/i.test(error.message)) return 'weak-password';
      // Keep Supabase's reason (rate limit, email sending, database…) for the UI.
      console.warn('[auth] sign-up failed:', error.status, error.message);
      this.lastError = error.message;
      return 'error';
    }
    // With confirmation on, an existing email comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) return 'exists';
    if (!data.session) return 'confirm-email';

    this.session.set(data.session);
    const admin = await this.checkAdmin();
    this.admin.set(admin);
    this.ready = Promise.resolve();
    return admin ? 'ok' : 'error';
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.admin.set(false);
    this.ready = null;
  }

  private async checkAdmin(): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('is_admin');
    return !error && data === true;
  }
}
