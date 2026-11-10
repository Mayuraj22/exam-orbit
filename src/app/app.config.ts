import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { GlobalErrorHandler } from './core/global-error-handler';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    // Root store is empty; feature slices register themselves on their routes.
    provideStore(),
    provideEffects(),
    // Devtools only in development builds.
    isDevMode() ? provideStoreDevtools({ maxAge: 25 }) : [],
  ],
};
