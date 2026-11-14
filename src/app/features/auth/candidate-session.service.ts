import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase';
import { CandidateLoginResult } from '../../shared/models/candidate-session.model';

const TOKEN_KEY = 'examorbit-candidate-session';

/**
 * Candidate login through database functions (no direct table access).
 * The session token is kept in sessionStorage: it survives a refresh but not
 * closing the tab, which suits a one-sitting exam on a shared computer.
 */
@Injectable({ providedIn: 'root' })
export class CandidateSessionService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async login(username: string, passcode: string): Promise<CandidateLoginResult> {
    const { data, error } = await this.supabase.rpc('candidate_login', {
      p_username: username,
      p_passcode: passcode,
    });
    if (error) throw error;
    const result = data as CandidateLoginResult;
    if (result.status === 'ok' && result.token) this.saveToken(result.token);
    return result;
  }

  /** Re-checks the saved session (e.g. after a refresh). Null when there is none. */
  async restore(): Promise<CandidateLoginResult | null> {
    const token = this.readToken();
    if (!token) return null;
    const { data, error } = await this.supabase.rpc('candidate_session', { p_token: token });
    if (error) throw error;
    const result = data as CandidateLoginResult;
    if (result.status !== 'ok') this.clearToken();
    return result;
  }

  async logout(): Promise<void> {
    const token = this.readToken();
    this.clearToken();
    if (token) await this.supabase.rpc('candidate_logout', { p_token: token });
  }

  hasSavedSession(): boolean {
    return !!this.readToken();
  }

  /** The current session token (sent with every exam request). */
  token(): string | null {
    return this.readToken();
  }

  /** The exam ended (the server already closed the session): forget it locally. */
  forget(): void {
    this.clearToken();
  }

  private readToken(): string | null {
    if (!this.isBrowser) return null;
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private saveToken(token: string): void {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage blocked: the session just won't survive a refresh.
    }
  }

  private clearToken(): void {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  }
}
