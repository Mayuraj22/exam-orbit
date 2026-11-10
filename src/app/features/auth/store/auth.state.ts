import { Candidate } from '../../../shared/models/candidate.model';

export interface CandidateAuthState {
  currentCandidate: Candidate | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export const initialCandidateAuthState: CandidateAuthState = {
  currentCandidate: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};
