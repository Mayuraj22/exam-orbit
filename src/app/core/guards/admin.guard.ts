import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';

/** Admin pages need a signed-in admin; otherwise go to /login and come back afterwards. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  // Admin pages render in the browser only; the session lives there.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const injector = inject(Injector);
  const router = inject(Router);

  // Loaded on demand so the Supabase client isn't part of the first download.
  const { AdminAuthService } = await import('../services/admin-auth.service');
  const auth = injector.get(AdminAuthService);
  await auth.init();

  return auth.isAdmin()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
