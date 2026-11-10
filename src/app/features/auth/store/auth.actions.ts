import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Candidate } from '../../../shared/models/candidate.model';

export const CandidateAuthActions = createActionGroup({
  source: 'Candidate Auth',
  events: {
    Login: props<{ username: string; passcode: string }>(),
    'Login Success': props<{ candidate: Candidate }>(),
    'Login Failure': props<{ error: string }>(),
    Logout: emptyProps(),
  },
});
