import { DOCUMENT, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'examorbit-theme';

/**
 * Light / dark / follow-system theme. The Material theme is built with
 * `light-dark()` colours, so switching only means setting `color-scheme`
 * on <html>. The choice is remembered in localStorage (per browser).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly preference = signal<ThemePreference>(this.load());

  constructor() {
    effect(() => {
      const pref = this.preference();
      this.document.documentElement.style.colorScheme = pref === 'system' ? 'light dark' : pref;
      this.save(pref);
    });
  }

  set(pref: ThemePreference): void {
    this.preference.set(pref);
  }

  private load(): ThemePreference {
    if (!this.isBrowser) return 'system';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch {
      return 'system'; // storage blocked (private mode, policies)
    }
  }

  private save(pref: ThemePreference): void {
    if (!this.isBrowser) return;
    try {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Not critical: the theme just won't be remembered.
    }
  }
}
