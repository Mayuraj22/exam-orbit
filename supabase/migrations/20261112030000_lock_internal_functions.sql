-- =============================================================================
-- Fix: internal helper functions were callable through the public API.
--
-- Supabase grants EXECUTE on new functions to the `anon` and `authenticated`
-- roles directly, so `revoke ... from public` alone didn't remove access.
-- These helpers are only meant to be called from other database functions.
-- =============================================================================

begin;

revoke execute on function public.candidate_from_token(uuid) from anon, authenticated;
revoke execute on function public.grade_answers(uuid, jsonb) from anon, authenticated;
revoke execute on function public.finish_attempt(uuid, boolean) from anon, authenticated;
revoke execute on function public.current_attempt(uuid) from anon, authenticated;
revoke execute on function public.candidate_session_payload(uuid) from anon, authenticated;
revoke execute on function public.hash_candidate_passcode() from anon, authenticated;

-- Future functions in this schema: don't grant to the API roles automatically.
alter default privileges in schema public revoke execute on functions from anon, authenticated;

commit;
