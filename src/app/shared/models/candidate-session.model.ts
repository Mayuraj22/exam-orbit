/** The signed-in candidate. */
export interface CandidateSessionInfo {
  candidate: { id: string; name: string; username: string };
}

/**
 * Outcome of logging in or restoring a session (from the database functions).
 * - ok: signed in (token issued)
 * - invalid: wrong username or passcode
 * - too_many_attempts: 5 wrong tries in 5 minutes
 * - expired: saved session is no longer valid
 */
export type CandidateLoginStatus = 'ok' | 'invalid' | 'too_many_attempts' | 'expired';

export interface CandidateLoginResult extends Partial<CandidateSessionInfo> {
  status: CandidateLoginStatus;
  token?: string;
}

/**
 * An exam on the candidate's "My exams" list.
 * state: available (can start) | in_progress (resume) | completed | not_open (not published)
 */
export interface AssignedExam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  pass_mark: number | null;
  camera_required: boolean;
  max_warnings: number;
  question_count: number;
  state: 'available' | 'in_progress' | 'completed' | 'not_open';
}
