-- =============================================================================
-- Candidates become people; exams are assigned to them.
--
--   Before: candidates(name, username, passcode, exam_id, has_attempted)
--   After:  candidates(name, username, passcode, email)          ← the person
--           exam_assignments(candidate_id, exam_id, has_attempted) ← may take exam
--
-- Existing data is kept: each candidate's current exam becomes an assignment.
-- One username + passcode now works for every exam assigned to that person.
-- After signing in, candidates choose from "My exams".
--
-- Runs in one transaction: all or nothing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Assignments, filled from the current data
-- -----------------------------------------------------------------------------
create table if not exists public.exam_assignments (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates (id) on delete cascade,
  exam_id       uuid not null references public.exams (id) on delete cascade,
  has_attempted boolean not null default false,
  assigned_at   timestamptz not null default now(),
  unique (candidate_id, exam_id)
);
create index if not exists exam_assignments_exam_idx on public.exam_assignments (exam_id);

alter table public.exam_assignments enable row level security;
drop policy if exists admin_all on public.exam_assignments;
create policy admin_all on public.exam_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidates' and column_name = 'exam_id'
  ) then
    insert into public.exam_assignments (candidate_id, exam_id, has_attempted)
    select id, exam_id, has_attempted from public.candidates where exam_id is not null
    on conflict (candidate_id, exam_id) do nothing;
  end if;
end $$;

-- Attempt numbers are now counted per exam (attempt 1 of exam A, attempt 1 of
-- exam B), so the uniqueness rules must include the exam.
alter table public.results drop constraint if exists results_candidate_attempt_unique;
alter table public.results
  add constraint results_candidate_attempt_unique unique (candidate_id, exam_id, attempt_number);

do $$
declare
  c text;
begin
  -- The original unique (candidate_id, attempt_number) on exam_attempts, whatever it is called.
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.exam_attempts'::regclass and con.contype = 'u'
  loop
    execute format('alter table public.exam_attempts drop constraint %I', c);
  end loop;
end $$;
alter table public.exam_attempts
  add constraint exam_attempts_candidate_exam_attempt_unique unique (candidate_id, exam_id, attempt_number);

-- -----------------------------------------------------------------------------
-- 2. Candidates: optional email; exam link moves to assignments
-- -----------------------------------------------------------------------------
alter table public.candidates add column if not exists email text;
alter table public.candidates drop column if exists exam_id;
alter table public.candidates drop column if exists has_attempted;

-- -----------------------------------------------------------------------------
-- 3. Candidate functions, rewritten for "person + assigned exams"
-- -----------------------------------------------------------------------------

-- Who is signed in (no exam details any more; see candidate_exams).
create or replace function public.candidate_session_payload(p_candidate_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'candidate', jsonb_build_object('id', c.id, 'name', c.name, 'username', c.username)
  )
  from public.candidates c
  where c.id = p_candidate_id;
$$;

-- Login: status ok | invalid | too_many_attempts
create or replace function public.candidate_login(p_username text, p_passcode text)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_failures integer;
  v_candidate public.candidates%rowtype;
  v_token uuid;
begin
  select count(*) into v_failures
  from public.candidate_login_attempts
  where username = v_username and not succeeded
    and attempted_at > now() - interval '5 minutes';
  if v_failures >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;

  select * into v_candidate from public.candidates where lower(username) = v_username;
  if not found
     or v_candidate.passcode_hash is null
     or v_candidate.passcode_hash <> extensions.crypt(upper(trim(coalesce(p_passcode, ''))), v_candidate.passcode_hash)
  then
    insert into public.candidate_login_attempts (username, succeeded) values (v_username, false);
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.candidate_login_attempts (username, succeeded) values (v_username, true);

  delete from public.candidate_sessions where candidate_id = v_candidate.id or expires_at < now();
  insert into public.candidate_sessions (candidate_id) values (v_candidate.id) returning token into v_token;

  return jsonb_build_object('status', 'ok', 'token', v_token) || public.candidate_session_payload(v_candidate.id);
end $$;

-- Resume after a refresh. status: ok | expired
create or replace function public.candidate_session(p_token uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object('status', 'ok', 'token', p_token) || public.candidate_session_payload(v_candidate_id);
end $$;

-- "My exams": every exam assigned to the signed-in candidate.
-- state: available | in_progress | completed | not_open
create or replace function public.candidate_exams(p_token uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'expired');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'exams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'description', e.description,
          'duration_minutes', e.duration_minutes,
          'pass_mark', e.pass_mark,
          'camera_required', e.camera_required,
          'max_warnings', e.max_warnings,
          'question_count', (select count(*) from public.questions q where q.exam_id = e.id),
          'state', case
            when exists (
              select 1 from public.exam_attempts t
              where t.candidate_id = a.candidate_id and t.exam_id = e.id and t.status = 'in_progress'
            ) then 'in_progress'
            when a.has_attempted then 'completed'
            when not e.is_published then 'not_open'
            else 'available'
          end
        )
        order by a.has_attempted, e.title
      )
      from public.exam_assignments a
      join public.exams e on e.id = a.exam_id
      where a.candidate_id = v_candidate_id
    ), '[]'::jsonb)
  );
end $$;

-- Finishing an attempt now marks the ASSIGNMENT as attempted, and keeps the
-- session so the candidate can go back to "My exams".
create or replace function public.finish_attempt(p_attempt_id uuid, p_terminated boolean)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  a public.exam_attempts%rowtype;
  g record;
  v_result uuid;
begin
  select * into a from public.exam_attempts where id = p_attempt_id for update;
  if a.status = 'submitted' then
    return a.result_id;
  end if;

  select * into g from public.grade_answers(a.exam_id, a.answers);

  insert into public.results (
    candidate_id, exam_id, answers, score, graded_answers, is_fully_graded,
    attempt_number, violation_count, terminated_by_proctoring
  ) values (
    a.candidate_id, a.exam_id, a.answers, g.score, g.graded, g.fully_graded,
    a.attempt_number, a.violation_count, p_terminated
  ) returning id into v_result;

  update public.exam_attempts set status = 'submitted', result_id = v_result where id = a.id;
  update public.exam_assignments set has_attempted = true
    where candidate_id = a.candidate_id and exam_id = a.exam_id;
  update public.proctoring_events set result_id = v_result
    where candidate_id = a.candidate_id and exam_id = a.exam_id and attempt_number = a.attempt_number;

  return v_result;
end $$;

-- Start (or resume) one assigned exam.
-- status: ok | expired | not_assigned | not_published | already_attempted | time_up | other_in_progress
drop function if exists public.candidate_start_exam(uuid);
create or replace function public.candidate_start_exam(p_token uuid, p_exam_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
  asg public.exam_assignments%rowtype;
  e public.exams%rowtype;
  a public.exam_attempts%rowtype;
  v_order uuid[];
  v_option_orders jsonb := '{}'::jsonb;
  v_number integer;
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into asg from public.exam_assignments
  where candidate_id = v_candidate_id and exam_id = p_exam_id;
  if not found then
    return jsonb_build_object('status', 'not_assigned');
  end if;

  select * into e from public.exams where id = p_exam_id;
  if not e.is_published then
    return jsonb_build_object('status', 'not_published');
  end if;

  a := public.current_attempt(v_candidate_id);

  -- One exam at a time.
  if a.id is not null and a.exam_id <> p_exam_id then
    if now() > a.deadline_at + interval '30 seconds' then
      perform public.finish_attempt(a.id, false);
      a := null;
    else
      return jsonb_build_object('status', 'other_in_progress', 'exam_id', a.exam_id);
    end if;
  end if;

  if a.id is not null and now() > a.deadline_at + interval '30 seconds' then
    perform public.finish_attempt(a.id, false);
    return jsonb_build_object('status', 'time_up');
  end if;

  if a.id is null then
    if asg.has_attempted then
      return jsonb_build_object('status', 'already_attempted');
    end if;

    select coalesce(max(n), 0) + 1 into v_number from (
      select attempt_number as n from public.results
        where candidate_id = v_candidate_id and exam_id = p_exam_id
      union all
      select attempt_number from public.exam_attempts
        where candidate_id = v_candidate_id and exam_id = p_exam_id
    ) x;

    if e.shuffle_questions then
      select array_agg(id order by random()) into v_order from public.questions where exam_id = e.id;
    else
      select array_agg(id order by order_index, id) into v_order from public.questions where exam_id = e.id;
    end if;

    if e.shuffle_options then
      select coalesce(jsonb_object_agg(
        q.id::text,
        (select jsonb_agg(o ->> 'id' order by random()) from jsonb_array_elements(q.options::jsonb) o)
      ), '{}'::jsonb)
      into v_option_orders
      from public.questions q
      where q.exam_id = e.id and q.question_type = 'mcq' and q.options is not null;
    end if;

    insert into public.exam_attempts (
      candidate_id, exam_id, attempt_number, deadline_at, question_order, option_orders
    ) values (
      v_candidate_id, e.id, v_number,
      now() + make_interval(mins => e.duration_minutes),
      coalesce(v_order, '{}'::uuid[]), v_option_orders
    ) returning * into a;

    insert into public.proctoring_events (exam_id, candidate_id, attempt_number, event_type)
    values (e.id, v_candidate_id, v_number, 'exam_started');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'attempt', jsonb_build_object(
      'attempt_number', a.attempt_number,
      'deadline_at', a.deadline_at,
      'server_now', now(),
      'answers', a.answers,
      'violation_count', a.violation_count
    ),
    'settings', jsonb_build_object(
      'camera_required', e.camera_required,
      'max_warnings', e.max_warnings,
      'snapshot_interval_seconds', e.snapshot_interval_seconds
    ),
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'text', q.question_text,
          'type', q.question_type,
          'options', case when q.question_type = 'mcq' then (
            select jsonb_agg(
              jsonb_build_object('id', t.o ->> 'id', 'text', t.o ->> 'text')
              order by coalesce(
                array_position(
                  array(select jsonb_array_elements_text(a.option_orders -> q.id::text)),
                  t.o ->> 'id'
                )::bigint,
                t.ord
              )
            )
            from jsonb_array_elements(q.options::jsonb) with ordinality as t(o, ord)
          ) end
        )
        order by array_position(a.question_order, q.id)
      ), '[]'::jsonb)
      from public.questions q
      where q.id = any (a.question_order)
    )
  );
end $$;

-- -----------------------------------------------------------------------------
-- 4. Permissions (new functions are not exposed automatically)
-- -----------------------------------------------------------------------------
revoke all on function public.candidate_session_payload(uuid) from public, anon, authenticated;
revoke all on function public.finish_attempt(uuid, boolean) from public, anon, authenticated;

revoke all on function public.candidate_login(text, text) from public;
revoke all on function public.candidate_session(uuid) from public;
revoke all on function public.candidate_exams(uuid) from public;
revoke all on function public.candidate_start_exam(uuid, uuid) from public;
grant execute on function public.candidate_login(text, text) to anon, authenticated;
grant execute on function public.candidate_session(uuid) to anon, authenticated;
grant execute on function public.candidate_exams(uuid) to anon, authenticated;
grant execute on function public.candidate_start_exam(uuid, uuid) to anon, authenticated;

commit;
