-- New proctoring violation: the candidate's face is only partly in frame
-- (cut off by the edge, or too far from the camera) for 4+ seconds.

alter table public.proctoring_events
  drop constraint if exists proctoring_events_event_type_check;
alter table public.proctoring_events
  add constraint proctoring_events_event_type_check check (event_type in (
    'exam_started', 'snapshot', 'no_face', 'multiple_faces', 'face_partial',
    'tab_switch', 'fullscreen_exit', 'camera_blocked', 'copy_paste', 'auto_submitted'
  ));

-- Same function as before; only the violation list gains 'face_partial'.
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
    ('no_face', 'multiple_faces', 'face_partial', 'tab_switch', 'fullscreen_exit', 'camera_blocked', 'copy_paste');
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

revoke all on function public.candidate_log_event(uuid, text, text, jsonb) from public;
grant execute on function public.candidate_log_event(uuid, text, text, jsonb) to anon, authenticated;
