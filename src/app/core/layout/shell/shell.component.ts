import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ThemePreference, ThemeService } from '../../services/theme.service';
import { AdminAuthService } from '../../services/admin-auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Not built yet: shown greyed out with a "Soon" label. */
  comingSoon?: boolean;
  /** URL paths (without query) that highlight this item. Exact match or a prefix ending in '/'. */
  activeFor: string[];
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly sidenav = viewChild.required(MatSidenav);

  /** Phones and small tablets get a slide-over menu instead of a fixed sidebar. */
  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin', activeFor: ['/admin'] },
    {
      label: 'Exams',
      icon: 'assignment',
      route: '/admin/exams',
      activeFor: ['/admin/exams', '/admin/exams/'],
    },
    {
      label: 'Candidates',
      icon: 'groups',
      route: '/admin/candidates',
      activeFor: ['/admin/candidates'],
    },
    { label: 'Results', icon: 'insights', route: '/admin/results', activeFor: ['/admin/results'] },
  ];

  /** Current path without query/fragment, updated on every navigation. */
  private readonly path = toSignal(
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: '' },
  );

  protected isActive(item: NavItem): boolean {
    const path = this.path();
    return item.activeFor.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p));
  }

  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected readonly email = this.auth.email;

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.router.navigateByUrl('/login');
  }

  private readonly document = inject(DOCUMENT);

  private static readonly THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
  private static readonly THEME_INFO: Record<ThemePreference, { label: string; icon: string }> = {
    system: { label: 'System', icon: 'brightness_auto' },
    light: { label: 'Light', icon: 'light_mode' },
    dark: { label: 'Dark', icon: 'dark_mode' },
  };

  protected readonly themeLabel = computed(
    () => ShellComponent.THEME_INFO[this.theme.preference()].label,
  );
  protected readonly themeIcon = computed(
    () => ShellComponent.THEME_INFO[this.theme.preference()].icon,
  );

  /** System → Light → Dark → System. */
  protected cycleTheme(): void {
    const order = ShellComponent.THEME_ORDER;
    this.theme.set(order[(order.indexOf(this.theme.preference()) + 1) % order.length]);
  }

  /** Keyboard users jump past the navigation. (Plain href="#…" would navigate because of <base href>.) */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.document.getElementById('main-content')?.focus();
  }

  /** Close the slide-over menu after navigating on small screens. */
  protected onNavigate(): void {
    if (this.isHandset()) this.sidenav().close();
  }
}
