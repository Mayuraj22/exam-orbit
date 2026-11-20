-- =============================================================================
-- Admin sign-up with private workspaces
--
--  * Anyone can create an admin account; each admin sees ONLY their own exams,
--    candidates, results and webcam photos.
--  * Every exam and candidate records its owner (filled in automatically).
--  * Existing data is given to the first admin (you).
--  * Candidate usernames stay unique across the whole app, because candidates
--    sign in with a username only.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Owners
-- -----------------------------------------------------------------------------
alter table public.exams      add column if not exists owner_id uuid references auth.users (id) on delete cascade;
alter table public.candidates add column if not exists owner_id uuid references auth.users (id) on delete cascade;

-- Existing rows belong to the first admin.
update public.exams
   set owner_id = (select user_id from public.admin_users order by created_at limit 1)
 where owner_id is null;
update public.candidates
   set owner_id = (select user_id from public.admin_users order by created_at limit 1)
 where owner_id is null;

alter table public.exams      alter column owner_id set default auth.uid();
alter table public.candidates alter column owner_id set default auth.uid();
alter table public.exams      alter column owner_id set not null;
alter table public.candidates alter column owner_id set not null;

create index if not exists exams_owner_idx      on public.exams (owner_id);
create index if not exists candidates_owner_idx on public.candidates (owner_id);

-- -----------------------------------------------------------------------------
-- 2. Every new account is an admin of its own (empty) workspace
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.admin_users (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke all on function public.handle_new_admin() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_admin();

-- -----------------------------------------------------------------------------
-- 3. Ownership checks (security definer: fast, and no policy recursion)
-- -----------------------------------------------------------------------------
create or replace function public.owns_exam(p_exam_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.exams where id = p_exam_id and owner_id = auth.uid());
$$;

create or replace function public.owns_candidate(p_candidate_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.candidates where id = p_candidate_id and owner_id = auth.uid());
$$;

revoke all on function public.owns_exam(uuid) from public, anon;
revoke all on function public.owns_candidate(uuid) from public, anon;
grant execute on function public.owns_exam(uuid) to authenticated;
grant execute on function public.owns_candidate(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Policies: replace "any admin sees everything" with "owner only"
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'exams', 'questions', 'candidates', 'results',
    'proctoring_events', 'exam_attempts', 'exam_assignments'
  ] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy owner_all on public.exams for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy owner_all on public.candidates for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy owner_all on public.questions for all to authenticated
  using (public.owns_exam(exam_id)) with check (public.owns_exam(exam_id));

create policy owner_all on public.results for all to authenticated
  using (public.owns_exam(exam_id)) with check (public.owns_exam(exam_id));

create policy owner_all on public.proctoring_events for all to authenticated
  using (public.owns_exam(exam_id)) with check (public.owns_exam(exam_id));

create policy owner_all on public.exam_attempts for all to authenticated
  using (public.owns_exam(exam_id)) with check (public.owns_exam(exam_id));

-- An assignment links your exam to your candidate: both must be yours.
create policy owner_all on public.exam_assignments for all to authenticated
  using (public.owns_exam(exam_id))
  with check (public.owns_exam(exam_id) and public.owns_candidate(candidate_id));

-- -----------------------------------------------------------------------------
-- 5. Webcam photos: only the owner of the exam can view them
-- -----------------------------------------------------------------------------
drop policy if exists "admins read snapshots" on storage.objects;
create policy "admins read snapshots" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proctoring-snapshots'
    and exists (
      select 1 from public.proctoring_events pe
      where pe.snapshot_path = storage.objects.name
        and public.owns_exam(pe.exam_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Is a candidate username free? (usernames are unique app-wide, and other
--    workspaces' candidates are invisible, so the app asks the server)
-- -----------------------------------------------------------------------------
create or replace function public.usernames_taken(p_usernames text[])
returns text[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(lower(username)), '{}')
  from public.candidates
  where lower(username) = any (select lower(u) from unnest(p_usernames) u);
$$;

revoke all on function public.usernames_taken(text[]) from public, anon;
grant execute on function public.usernames_taken(text[]) to authenticated;

commit;

-- =============================================================================
-- AFTER RUNNING (Supabase dashboard):
--   Authentication → Sign In / Providers → Email:
--     * "Allow new users to sign up": ON
--     * "Confirm email": your choice. ON = new admins must click a link in an
--       email first (Supabase's built-in mailer only sends a few per hour).
--   Authentication → URL Configuration: add http://localhost:4200 (and your
--   deployed URL later) to Redirect URLs, so the confirm link comes back here.
-- =============================================================================
