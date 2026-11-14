// Supabase Edge Function: delete webcam snapshots older than 30 days.
//
// Runs daily (Supabase → Integrations → Cron). Uses the service role, which
// Supabase provides to Edge Functions automatically. Proctoring events and
// review decisions are kept; only the photos are removed, and each event is
// marked with `snapshot_deleted_at`.
//
// Safe to trigger by anyone: it only ever removes photos past the retention
// period, which is what candidates were promised on the consent screen.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'proctoring-snapshots';
const RETENTION = '30 days';
const BATCH = 500;
const MAX_BATCHES = 20; // up to 10,000 photos per run

Deno.serve(async () => {
  // Supabase provides these automatically. Newer projects may only have the
  // "secret" key; older ones the "service role" key. Either works here.
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !key) {
    return json(
      { ok: false, error: 'Missing SUPABASE_URL or service key in the function environment' },
      500,
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let deleted = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data: paths, error } = await supabase.rpc('expired_snapshot_paths', {
      p_older_than: RETENTION,
      p_limit: BATCH,
    });
    if (error) return json({ ok: false, step: 'list', error: error.message, deleted }, 500);
    if (!paths?.length) break;

    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths as string[]);
    if (removeError) {
      return json({ ok: false, step: 'remove', error: removeError.message, deleted }, 500);
    }

    await supabase.rpc('mark_snapshots_deleted', { p_paths: paths });
    deleted += (paths as string[]).length;
    if ((paths as string[]).length < BATCH) break;
  }

  return json({ ok: true, deleted });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
