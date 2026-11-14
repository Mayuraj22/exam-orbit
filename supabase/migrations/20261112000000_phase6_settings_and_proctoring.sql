-- =============================================================================
-- Phase 6: exam settings, proctoring storage, and data-integrity fixes
--
-- Safe to run more than once: every step checks before it changes anything.
-- Run it in Supabase → SQL Editor → New query → paste → Run.
-- Everything runs in one transaction: if any step fails, nothing is changed.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Exam settings
-- -----------------------------------------------------------------------------
alter table public.exams
  -- Minimum score (in %) to pass. NULL = no pass mark (results show score only).
  add column if not exists pass_mark integer,
  add column if not exists shuffle_questions boolean not null default false,
  add column if not exists shuffle_options boolean not null default false,
  -- Proctoring
  add column if not exists camera_required boolean not null default false,
  -- Warnings shown before the exam is auto-submitted (the next violation ends it).
  add column if not exists max_warnings integer not null default 2,
  -- How often a routine webcam snapshot is taken.
  add column if not exists snapshot_interval_seconds integer not null default 90;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exams_pass_mark_range') then
    alter table public.exams
      add constraint exams_pass_mark_range check (pass_mark is null or pass_mark between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exams_max_warnings_range') then
    alter table public.exams
      add constraint exams_max_warnings_range check (max_warnings between 0 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'exams_snapshot_interval_range') then
    alter table public.exams
      add constraint exams_snapshot_interval_range check (snapshot_interval_seconds between 30 and 600);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Results: attempts and proctoring outcome
-- -----------------------------------------------------------------------------
alter table public.results
  -- 1 for the first attempt; "Reset attempt" lets a candidate submit attempt 2, 3…
  add column if not exists attempt_number integer not null default 1,
  add column if not exists violation_count integer not null default 0,
  add column if not exists terminated_by_proctoring boolean not null default false;

do $$
begin
  -- One result per candidate per attempt (stops accidental double submissions).
  if not exists (select 1 from pg_constraint where conname = 'results_candidate_attempt_unique') then
    alter table public.results
      add constraint results_candidate_attempt_unique unique (candidate_id, attempt_number);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Unique usernames (case-insensitive)
--    Candidates log in with username + passcode and no exam, so a username
--    must identify exactly one candidate.
-- -----------------------------------------------------------------------------
do $$
declare
  dupes text;
begin
  select string_agg(u, ', ') into dupes
  from (
    select lower(username) as u
    from public.candidates
    group by lower(username)
    having count(*) > 1
  ) d;

  if dupes is not null then
    raise exception 'Duplicate usernames must be fixed before this migration can run: %', dupes;
  end if;
end $$;

create unique index if not exists candidates_username_unique
  on public.candidates (lower(username));

-- -----------------------------------------------------------------------------
-- 4. Deleting an exam/candidate also deletes what belongs to it
--    (recreates each foreign key with ON DELETE CASCADE, whatever it was called)
-- -----------------------------------------------------------------------------
create or replace function pg_temp.set_cascade_fk(
  p_table text, p_column text, p_ref_table text
) returns void language plpgsql as $$
declare
  fk record;
begin
  for fk in
    select con.conname
    from pg_constraint con
    join pg_class tbl on tbl.oid = con.conrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    join pg_attribute att on att.attrelid = tbl.oid and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and ns.nspname = 'public'
      and tbl.relname = p_table
      and att.attname = p_column
  loop
    execute format('alter table public.%I drop constraint %I', p_table, fk.conname);
  end loop;

  execute format(
    'alter table public.%I add constraint %I foreign key (%I) references public.%I (id) on delete cascade',
    p_table, p_table || '_' || p_column || '_fkey', p_column, p_ref_table
  );
end $$;

select pg_temp.set_cascade_fk('questions',  'exam_id',      'exams');
select pg_temp.set_cascade_fk('candidates', 'exam_id',      'exams');
select pg_temp.set_cascade_fk('results',    'exam_id',      'exams');
select pg_temp.set_cascade_fk('results',    'candidate_id', 'candidates');

-- -----------------------------------------------------------------------------
-- 5. Proctoring events (warnings, snapshots, auto-submit)
--    Events happen during the exam, before a result exists, so they are keyed
--    by candidate + attempt; result_id is filled in on submit.
-- -----------------------------------------------------------------------------
create table if not exists public.proctoring_events (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams (id) on delete cascade,
  candidate_id    uuid not null references public.candidates (id) on delete cascade,
  result_id       uuid references public.results (id) on delete cascade,
  attempt_number  integer not null default 1,
  occurred_at     timestamptz not null default now(),
  event_type      text not null check (event_type in (
                    'exam_started',
                    'snapshot',           -- routine snapshot, not a violation
                    'no_face',
                    'multiple_faces',
                    'tab_switch',
                    'fullscreen_exit',
                    'camera_blocked',
                    'copy_paste',
                    'auto_submitted'
                  )),
  -- 1, 2… for violations that produced a warning; NULL for routine events.
  warning_number  integer,
  -- Path of the snapshot in the "proctoring-snapshots" storage bucket.
  snapshot_path   text,
  details         jsonb not null default '{}'::jsonb
);

create index if not exists proctoring_events_attempt_idx
  on public.proctoring_events (candidate_id, attempt_number, occurred_at);
create index if not exists proctoring_events_result_idx
  on public.proctoring_events (result_id);

-- Locked down by default: no access through the public API until Phase 7
-- adds login and proper policies. (Nothing in the app reads this table yet.)
alter table public.proctoring_events enable row level security;

-- -----------------------------------------------------------------------------
-- 6. Private storage bucket for webcam snapshots
--    JPEG/WebP only, max 500 KB each. Private: no public URLs.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proctoring-snapshots', 'proctoring-snapshots', false, 512000, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- -----------------------------------------------------------------------------
-- Check (optional): run after the migration; every row should say "ok".
-- -----------------------------------------------------------------------------
-- select 'exams settings'     as item, case when count(*) = 6 then 'ok' else 'missing' end as status
--   from information_schema.columns where table_name = 'exams'
--   and column_name in ('pass_mark','shuffle_questions','shuffle_options','camera_required','max_warnings','snapshot_interval_seconds')
-- union all
-- select 'results columns', case when count(*) = 3 then 'ok' else 'missing' end
--   from information_schema.columns where table_name = 'results'
--   and column_name in ('attempt_number','violation_count','terminated_by_proctoring')
-- union all
-- select 'proctoring_events', case when count(*) = 1 then 'ok' else 'missing' end
--   from information_schema.tables where table_name = 'proctoring_events'
-- union all
-- select 'snapshot bucket', case when count(*) = 1 then 'ok' else 'missing' end
--   from storage.buckets where id = 'proctoring-snapshots';
