import {
  CandidateLoginStatus,
  CandidateSessionInfo,
} from '../../../shared/models/candidate-session.model';

export interface CandidateAuthState {
  /** Candidate + exam details (also kept for "already attempted" / "not open" screens). */
  session: CandidateSessionInfo | null;
  /** Last answer from the server; null before any attempt. */
  status: CandidateLoginStatus | null;
  /** True only with a valid session that may start the exam. */
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
