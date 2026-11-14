-- =============================================================================
-- Phase 8: taking the exam, server-side grading, and webcam proctoring
--
-- Candidates still never touch tables directly. Every step is a database
-- function that checks the candidate's session token:
--   candidate_start_exam   → questions (no answers), timer, saved progress
--   candidate_save_answer  → saves one answer as they go
--   candidate_log_event    → snapshot / violation; auto-submits after too many
--   candidate_submit       → grades on the server and stores the result
--
-- Safe to run more than once. Runs in one transaction: all or nothing.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Attempts in progress
--    One row per attempt: deadline, question/option order (for shuffling),
--    answers saved so far, violations. Becomes a `results` row on submit.
-- -----------------------------------------------------------------------------
create table if not exists public.exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references public.candidates (id) on delete cascade,
  exam_id         uuid not null references public.exams (id) on delete cascade,
  attempt_number  integer not null,
  started_at      timestamptz not null default now(),
  deadline_at     timestamptz not null,
  question_order  uuid[] not null,
  option_orders   jsonb not null default '{}'::jsonb,
  answers         jsonb not null default '{}'::jsonb,
  violation_count integer not null default 0,
  status          text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  result_id       uuid references public.results (id) on delete set null,
  unique (candidate_id, attempt_number)
);

alter table public.exam_attempts enable row level security;
drop policy if exists admin_all on public.exam_attempts;
create policy admin_all on public.exam_attempts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. Internal helpers (not callable from the app)
-- -----------------------------------------------------------------------------

-- Session token → candidate id (null if missing or expired).
create or replace function public.candidate_from_token(p_token uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select candidate_id from public.candidate_sessions where token = p_token and expires_at > now();
$$;

-- Grades answers the same way the admin grading screen does:
-- MCQ: chosen option id vs the correct option (stored as id, or as text on older questions).
-- Input: exact match ignoring case and extra spaces = correct; empty = wrong;
--        anything else is left for the admin (not graded).
create or replace function public.grade_answers(
  p_exam_id uuid, p_answers jsonb,
  out graded jsonb, out score integer, out fully_graded boolean
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  q record;
  v_answer text;
  v_correct_id text;
  v_mark boolean;
begin
  graded := '{}'::jsonb;
  score := 0;
  fully_graded := true;

  for q in select * from public.questions where exam_id = p_exam_id loop
    v_answer := p_answers ->> q.id::text;

    if q.question_type = 'mcq' then
      select o ->> 'id' into v_correct_id
      from jsonb_array_elements(coalesce(q.options::jsonb, '[]'::jsonb)) o
      where o ->> 'id' = q.correct_answer or o ->> 'text' = q.correct_answer
      limit 1;
      v_mark := v_answer is not null and v_correct_id is not null and v_answer = v_correct_id;
    elsif v_answer is null or trim(v_answer) = '' then
      v_mark := false;
    elsif q.correct_answer is not null
      and lower(regexp_replace(trim(v_answer), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(q.correct_answer), '\s+', ' ', 'g')) then
      v_mark := true;
    else
      v_mark := null;           -- needs the admin
      fully_graded := false;
    end if;

    if v_mark is not null then
      graded := graded || jsonb_build_object(q.id::text, v_mark);
    end if;
    if v_mark then
      score := score + 1;
    end if;
  end loop;
end $$;

-- Ends an attempt: grade, store the result, mark the candidate as attempted.
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
  update public.candidates set has_attempted = true where id = a.candidate_id;
  update public.proctoring_events set result_id = v_result
    where candidate_id = a.candidate_id and attempt_number = a.attempt_number;
  -- The exam is over: end the session.
  delete from public.candidate_sessions where candidate_id = a.candidate_id;

  return v_result;
end $$;

-- The in-progress attempt for a candidate (locked for update), if any.
create or replace function public.current_attempt(p_candidate_id uuid)
returns public.exam_attempts
language sql volatile security definer
set search_path = public
as $$
  select * from public.exam_attempts
  where candidate_id = p_candidate_id and status = 'in_progress'
  order by attempt_number desc
  limit 1
  for update;
$$;

-- Storage policy check: may this folder (a session token) upload snapshots?
create or replace function public.candidate_can_upload(p_folder text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidate_sessions s
    join public.exam_attempts a on a.candidate_id = s.candidate_id and a.status = 'in_progress'
    where s.token::text = p_folder and s.expires_at > now()
  );
$$;

revoke all on function public.candidate_from_token(uuid) from public;
revoke all on function public.grade_answers(uuid, jsonb) from public;
revoke all on function public.finish_attempt(uuid, boolean) from public;
revoke all on function public.current_attempt(uuid) from public;
revoke all on function public.candidate_can_upload(text) from public;
grant execute on function public.candidate_can_upload(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Start (or resume) the exam
--    status: ok | expired | not_published | already_attempted | time_up
-- -----------------------------------------------------------------------------
create or replace function public.candidate_start_exam(p_token uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
  c public.candidates%rowtype;
  e public.exams%rowtype;
  a public.exam_attempts%rowtype;
  v_order uuid[];
  v_option_orders jsonb := '{}'::jsonb;
  v_number integer;
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'expired');
  end if;

  select * into c from public.candidates where id = v_candidate_id;
  select * into e from public.exams where id = c.exam_id;

  if not e.is_published then
    return jsonb_build_object('status', 'not_published');
  end if;

  a := public.current_attempt(v_candidate_id);

  -- Time ran out while they were away: submit what was saved.
  if a.id is not null and now() > a.deadline_at + interval '30 seconds' then
    perform public.finish_attempt(a.id, false);
    return jsonb_build_object('status', 'time_up');
  end if;

  if a.id is null then
    if c.has_attempted then
      return jsonb_build_object('status', 'already_attempted');
    end if;

    select coalesce(max(n), 0) + 1 into v_number from (
      select attempt_number as n from public.results where candidate_id = v_candidate_id
      union all
      select attempt_number from public.exam_attempts where candidate_id = v_candidate_id
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
    -- Questions in this attempt's order, WITHOUT correct answers.
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
-- 4. Save one answer.  status: ok | not_in_progress | time_up | invalid_question
--    An empty answer clears it.
-- -----------------------------------------------------------------------------
create or replace function public.candidate_save_answer(p_token uuid, p_question_id uuid, p_answer text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
  a public.exam_attempts%rowtype;
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'not_in_progress');
  end if;

  a := public.current_attempt(v_candidate_id);
  if a.id is null then
    return jsonb_build_object('status', 'not_in_progress');
  end if;

  if now() > a.deadline_at + interval '30 seconds' then
    perform public.finish_attempt(a.id, false);
    return jsonb_build_object('status', 'time_up');
  end if;

  if not (p_question_id = any (a.question_order)) then
    return jsonb_build_object('status', 'invalid_question');
  end if;

  update public.exam_attempts
  set answers = case
    when p_answer is null or trim(p_answer) = '' then answers - p_question_id::text
    else answers || jsonb_build_object(p_question_id::text, left(p_answer, 2000))
  end
  where id = a.id;

  return jsonb_build_object('status', 'ok');
end $$;

-- -----------------------------------------------------------------------------
-- 5. Proctoring event (snapshot or violation)
--    Violations raise the count. With the webcam required, going over the
--    exam's max_warnings submits the exam immediately.
--    Returns {status, violation_count, warning_number, max_warnings, terminated}.
-- -----------------------------------------------------------------------------
create or replace function public.candidate_log_event(
  p_token uuid, p_event_type text, p_snapshot_path text default null, p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
  a public.exam_attempts%rowtype;
  e public.exams%rowtype;
  v_is_violation boolean := p_event_type in
    ('no_face', 'multiple_faces', 'tab_switch', 'fullscreen_exit', 'camera_blocked', 'copy_paste');
  v_count integer;
  v_warning integer;
  v_terminate boolean := false;
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'not_in_progress');
  end if;
  if not v_is_violation and p_event_type <> 'snapshot' then
    return jsonb_build_object('status', 'invalid_event');
  end if;
  -- A snapshot must sit in this session's own folder.
  if p_snapshot_path is not null and p_snapshot_path not like p_token::text || '/%' then
    return jsonb_build_object('status', 'invalid_snapshot');
  end if;

  a := public.current_attempt(v_candidate_id);
  if a.id is null then
    return jsonb_build_object('status', 'not_in_progress');
  end if;
  select * into e from public.exams where id = a.exam_id;

  v_count := a.violation_count;
  if v_is_violation then
    v_count := v_count + 1;
    update public.exam_attempts set violation_count = v_count where id = a.id;
    v_terminate := e.camera_required and v_count > e.max_warnings;
    v_warning := case when v_count <= e.max_warnings then v_count end;
  end if;

  insert into public.proctoring_events (
    exam_id, candidate_id, attempt_number, event_type, warning_number, snapshot_path, details
  ) values (
    a.exam_id, v_candidate_id, a.attempt_number, p_event_type, v_warning, p_snapshot_path,
    coalesce(p_details, '{}'::jsonb)
  );

  if v_terminate then
    insert into public.proctoring_events (exam_id, candidate_id, attempt_number, event_type, details)
    values (a.exam_id, v_candidate_id, a.attempt_number, 'auto_submitted',
            jsonb_build_object('violations', v_count));
    perform public.finish_attempt(a.id, true);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'violation_count', v_count,
    'warning_number', v_warning,
    'max_warnings', e.max_warnings,
    'terminated', v_terminate
  );
end $$;

-- -----------------------------------------------------------------------------
-- 6. Submit.  status: submitted | not_in_progress
-- -----------------------------------------------------------------------------
create or replace function public.candidate_submit(p_token uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := public.candidate_from_token(p_token);
  a public.exam_attempts%rowtype;
begin
  if v_candidate_id is null then
    return jsonb_build_object('status', 'not_in_progress');
  end if;
  a := public.current_attempt(v_candidate_id);
  if a.id is null then
    return jsonb_build_object('status', 'not_in_progress');
  end if;
  perform public.finish_attempt(a.id, false);
  return jsonb_build_object('status', 'submitted');
end $$;

revoke all on function public.candidate_start_exam(uuid) from public;
revoke all on function public.candidate_save_answer(uuid, uuid, text) from public;
revoke all on function public.candidate_log_event(uuid, text, text, jsonb) from public;
revoke all on function public.candidate_submit(uuid) from public;
grant execute on function public.candidate_start_exam(uuid) to anon, authenticated;
grant execute on function public.candidate_save_answer(uuid, uuid, text) to anon, authenticated;
grant execute on function public.candidate_log_event(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.candidate_submit(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Snapshot storage access
--    Candidates may only ADD images, only into their own session folder,
--    only while their attempt is in progress. Only admins can view them.
-- -----------------------------------------------------------------------------
drop policy if exists "candidates upload own snapshots" on storage.objects;
create policy "candidates upload own snapshots" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'proctoring-snapshots'
    and public.candidate_can_upload((storage.foldername(name))[1])
  );

drop policy if exists "admins read snapshots" on storage.objects;
create policy "admins read snapshots" on storage.objects
  for select to authenticated
  using (bucket_id = 'proctoring-snapshots' and public.is_admin());

commit;
