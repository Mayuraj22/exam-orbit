-- =============================================================================
-- Phase 9: proctoring review and automatic snapshot deletion
--
--  1. Review decision on each result (cleared / suspicious / disqualified)
--  2. Who reviewed it and when is recorded automatically
--  3. Helpers for the daily clean-up that deletes snapshots after 30 days
--
-- Safe to run more than once. Runs in one transaction: all or nothing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Review decision
--    Disqualified keeps the score (so the decision can be reversed); the app
--    shows "Disqualified" instead of Pass/Fail.
-- -----------------------------------------------------------------------------
alter table public.results
  add column if not exists review_status text,
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'results_review_status_check') then
    alter table public.results
      add constraint results_review_status_check
      check (review_status is null or review_status in ('cleared', 'suspicious', 'disqualified'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Record the reviewer automatically (can't be faked from the browser)
-- -----------------------------------------------------------------------------
create or replace function public.stamp_result_review()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.review_status is distinct from old.review_status
     or new.review_note is distinct from old.review_note then
    new.reviewed_at := case when new.review_status is null then null else now() end;
    new.reviewed_by := case when new.review_status is null then null else auth.uid() end;
  end if;
  return new;
end $$;

revoke all on function public.stamp_result_review() from public, anon, authenticated;

drop trigger if exists results_stamp_review on public.results;
create trigger results_stamp_review
  before update of review_status, review_note on public.results
  for each row execute function public.stamp_result_review();

-- -----------------------------------------------------------------------------
-- 3. Snapshot clean-up helpers (used only by the daily clean-up function,
--    which runs with the service role; no one else can call them)
-- -----------------------------------------------------------------------------

-- Snapshot files older than the cut-off (oldest first, in batches).
create or replace function public.expired_snapshot_paths(p_older_than interval default '30 days', p_limit integer default 500)
returns setof text
language sql stable security definer
set search_path = public, storage
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'proctoring-snapshots'
    and o.created_at < now() - p_older_than
  order by o.created_at
  limit p_limit;
$$;

-- After the files are deleted: keep the events, note that the photo is gone.
create or replace function public.mark_snapshots_deleted(p_paths text[])
returns integer
language sql volatile security definer
set search_path = public
as $$
  with updated as (
    update public.proctoring_events
    set snapshot_path = null,
        details = details || jsonb_build_object('snapshot_deleted_at', now())
    where snapshot_path = any (p_paths)
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.expired_snapshot_paths(interval, integer) from public, anon, authenticated;
revoke all on function public.mark_snapshots_deleted(text[]) from public, anon, authenticated;
grant execute on function public.expired_snapshot_paths(interval, integer) to service_role;
grant execute on function public.mark_snapshots_deleted(text[]) to service_role;

commit;
