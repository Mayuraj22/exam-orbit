import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Signed-in pages show live, per-user data: render in the browser only,
  // never bake Supabase data into static HTML at build time.
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'exam/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
