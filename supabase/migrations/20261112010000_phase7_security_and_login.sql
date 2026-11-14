-- =============================================================================
-- Phase 7: admin login, hashed candidate passcodes, secure candidate login,
--          and row-level security on every table
--
-- AFTER THIS RUNS, THE ADMIN PAGES REQUIRE SIGNING IN.
-- Follow the "after running" steps at the bottom to create your admin account.
--
-- Safe to run more than once. Runs in one transaction: all or nothing.
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Admins
--    Admins sign in with Supabase Auth (email + password). Only users listed
--    here count as admins, so turning on sign-ups can never create an admin.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

drop policy if exists admin_users_read_self on public.admin_users;
create policy admin_users_read_self on public.admin_users
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Hashed candidate passcodes
--    The app still writes `passcode` when creating or resetting a candidate;
--    a trigger hashes it into `passcode_hash` and clears `passcode`, so the
--    plain passcode is never stored. Passcodes are case-insensitive.
-- -----------------------------------------------------------------------------
alter table public.candidates add column if not exists passcode_hash text;
alter table public.candidates alter column passcode drop not null;

-- Hash existing plain passcodes (they keep working with the same value).
update public.candidates
set passcode_hash = extensions.crypt(upper(trim(passcode)), extensions.gen_salt('bf', 10)),
    passcode = null
where passcode is not null and passcode <> '';

create or replace function public.hash_candidate_passcode()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.passcode is not null and trim(new.passcode) <> '' then
    new.passcode_hash := extensions.crypt(upper(trim(new.passcode)), extensions.gen_salt('bf', 10));
  end if;
  new.passcode := null;
  return new;
end $$;

revoke all on function public.hash_candidate_passcode() from public;

drop trigger if exists candidates_hash_passcode on public.candidates;
create trigger candidates_hash_passcode
  before insert or update of passcode on public.candidates
  for each row execute function public.hash_candidate_passcode();

-- -----------------------------------------------------------------------------
-- 3. Candidate sessions and login rate limiting
--    Candidates don't get Supabase accounts. Logging in returns a random
--    session token; every candidate request is a database function that
--    checks it. Candidates never touch the tables directly.
-- -----------------------------------------------------------------------------
create table if not exists public.candidate_sessions (
  token        uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '8 hours'
);
create index if not exists candidate_sessions_candidate_idx on public.candidate_sessions (candidate_id);
alter table public.candidate_sessions enable row level security;

create table if not exists public.candidate_login_attempts (
  id           bigint generated always as identity primary key,
  username     text not null,
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists candidate_login_attempts_lookup_idx
  on public.candidate_login_attempts (username, attempted_at);
alter table public.candidate_login_attempts enable row level security;

-- What the candidate screens need about themselves and their exam.
-- Never includes questions, answers or passcode hashes.
create or replace function public.candidate_session_payload(p_candidate_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'candidate', jsonb_build_object('id', c.id, 'name', c.name, 'username', c.username),
    'exam', jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'description', e.description,
      'duration_minutes', e.duration_minutes,
      'pass_mark', e.pass_mark,
      'camera_required', e.camera_required,
      'max_warnings', e.max_warnings,
      'question_count', (select count(*) from public.questions q where q.exam_id = e.id)
    )
  )
  from public.candidates c
  join public.exams e on e.id = c.exam_id
  where c.id = p_candidate_id;
$$;

revoke all on function public.candidate_session_payload(uuid) from public;

-- Login. Returns {status, token?, candidate?, exam?}.
-- status: ok | invalid | too_many_attempts | not_published | already_attempted
create or replace function public.candidate_login(p_username text, p_passcode text)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_failures integer;
  v_candidate public.candidates%rowtype;
  v_exam public.exams%rowtype;
  v_token uuid;
begin
  -- At most 5 wrong passcodes per username per 5 minutes.
  select count(*) into v_failures
  from public.candidate_login_attempts
  where username = v_username
    and not succeeded
    and attempted_at > now() - interval '5 minutes';

  if v_failures >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;

  select * into v_candidate from public.candidates where lower(username) = v_username;

  -- Same answer for "no such user" and "wrong passcode", so usernames can't be probed.
  if not found
     or v_candidate.passcode_hash is null
     or v_candidate.passcode_hash <> extensions.crypt(upper(trim(coalesce(p_passcode, ''))), v_candidate.passcode_hash)
  then
    insert into public.candidate_login_attempts (username, succeeded) values (v_username, false);
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.candidate_login_attempts (username, succeeded) values (v_username, true);

  select * into v_exam from public.exams where id = v_candidate.exam_id;

  if not v_exam.is_published then
    return jsonb_build_object('status', 'not_published') || public.candidate_session_payload(v_candidate.id);
  end if;

  if v_candidate.has_attempted then
    return jsonb_build_object('status', 'already_attempted') || public.candidate_session_payload(v_candidate.id);
  end if;

  -- One active session per candidate; also tidy up expired ones.
  delete from public.candidate_sessions where candidate_id = v_candidate.id or expires_at < now();
  insert into public.candidate_sessions (candidate_id) values (v_candidate.id) returning token into v_token;

  return jsonb_build_object('status', 'ok', 'token', v_token) || public.candidate_session_payload(v_candidate.id);
end $$;

-- Resume after a page refresh. status: ok | expired | not_published | already_attempted
create or replace function public.candidate_session(p_token uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_candidate_id uuid;
  v_published boolean;
  v_attempted boolean;
begin
  select s.candidate_id, e.is_published, c.has_attempted
    into v_candidate_id, v_published, v_attempted
  from public.candidate_sessions s
  join public.candidates c on c.id = s.candidate_id
  join public.exams e on e.id = c.exam_id
  where s.token = p_token and s.expires_at > now();

  if v_candidate_id is null then
    return jsonb_build_object('status', 'expired');
  end if;
  if not v_published then
    return jsonb_build_object('status', 'not_published') || public.candidate_session_payload(v_candidate_id);
  end if;
  if v_attempted then
    return jsonb_build_object('status', 'already_attempted') || public.candidate_session_payload(v_candidate_id);
  end if;
  return jsonb_build_object('status', 'ok', 'token', p_token) || public.candidate_session_payload(v_candidate_id);
end $$;

create or replace function public.candidate_logout(p_token uuid)
returns void
language sql volatile security definer
set search_path = public
as $$
  delete from public.candidate_sessions where token = p_token;
$$;

revoke all on function public.candidate_login(text, text) from public;
revoke all on function public.candidate_session(uuid) from public;
revoke all on function public.candidate_logout(uuid) from public;
grant execute on function public.candidate_login(text, text) to anon, authenticated;
grant execute on function public.candidate_session(uuid) to anon, authenticated;
grant execute on function public.candidate_logout(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Row-level security: only admins can read or change the exam data
--    Removes any older policies first (e.g. "allow everyone"), then adds one
--    admin-only policy per table. Candidates go through the functions above.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['exams', 'questions', 'candidates', 'results', 'proctoring_events'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated '
      'using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;

commit;

-- =============================================================================
-- AFTER RUNNING: create your admin account (one time)
--
--  1. Supabase → Authentication → Users → "Add user" → "Create new user"
--     Enter your email and a strong password, tick "Auto Confirm User".
--  2. Run this (with your email) in the SQL Editor:
--
--     insert into public.admin_users (user_id)
--     select id from auth.users where email = 'you@example.com'
--     on conflict do nothing;
--
--  3. Recommended: Authentication → Sign In / Providers → turn OFF
--     "Allow new users to sign up". (Even if on, new users are not admins.)
-- =============================================================================
