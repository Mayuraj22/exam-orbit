import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

/**
 * Root: each area brings its own layout. /admin uses the shell (sidebar +
 * toolbar), /login and the candidate /exam pages use simple full-page layouts.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Applies the saved light/dark choice on every page, not just inside the shell.
  private readonly theme = inject(ThemeService);
}
