import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { CandidateLoginResult } from '../../../shared/models/candidate-session.model';

export const CandidateAuthActions = createActionGroup({
  source: 'Candidate Auth',
  events: {
    Login: props<{ username: string; passcode: string }>(),
    /** Any answer from the server: ok, invalid, blocked… (see CandidateLoginStatus). */
    'Login Result': props<{ result: CandidateLoginResult }>(),
    /** Network or server error (not a wrong passcode). */
    'Login Failure': props<{ error: string }>(),

    /** Check a session saved in this tab (after a refresh). */
    'Restore Session': emptyProps(),
    'Restore Session Result': props<{ result: CandidateLoginResult | null }>(),

    Logout: emptyProps(),
    /** Submitted or ended by proctoring: the server closed the session. */
    'Exam Finished': emptyProps(),
  },
});
