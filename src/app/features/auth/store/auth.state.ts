import {
  CandidateLoginStatus,
  CandidateSessionInfo,
} from '../../../shared/models/candidate-session.model';

export interface CandidateAuthState {
  /** The signed-in candidate. */
  session: CandidateSessionInfo | null;
  /** Last answer from the server; null before any attempt. */
  status: CandidateLoginStatus | null;
  /** True with a valid session. */
  isAuthenticated: boolean;
  loading: boolean;
  /** Network/server error message (wrong passcodes use `status` instead). */
  error: string | null;
  /** A saved session has been checked (so guards don't wait twice). */
  restored: boolean;
}

export const initialCandidateAuthState: CandidateAuthState = {
  session: null,
  status: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  restored: false,
};
