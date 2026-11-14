/** What the candidate screens know about the signed-in candidate and their exam. */
export interface CandidateSessionInfo {
  candidate: { id: string; name: string; username: string };
  exam: {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    pass_mark: number | null;
    camera_required: boolean;
    max_warnings: number;
    question_count: number;
  };
}

/**
 * Outcome of logging in or restoring a session (from the database functions).
 * - ok: can start the exam (token issued)
 * - invalid: wrong username or passcode
 * - too_many_attempts: 5 wrong tries in 5 minutes
 * - not_published / already_attempted: correct login, but the exam can't be taken
 * - expired: saved session is no longer valid
 */
export type CandidateLoginStatus =
  'ok' | 'invalid' | 'too_many_attempts' | 'not_published' | 'already_attempted' | 'expired';

export interface CandidateLoginResult extends Partial<CandidateSessionInfo> {
  status: CandidateLoginStatus;
  token?: string;
}
