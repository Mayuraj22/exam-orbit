import { createFeature, createReducer, on } from '@ngrx/store';
import { CandidateAuthActions } from './auth.actions';
import { initialCandidateAuthState } from './auth.state';

const candidateAuthReducer = createReducer(
  initialCandidateAuthState,
  on(CandidateAuthActions.login, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(CandidateAuthActions.loginSuccess, (state, { candidate }) => ({
    ...state,
    currentCandidate: candidate,
    isAuthenticated: true,
    loading: false,
    error: null,
  })),
  on(CandidateAuthActions.loginFailure, (state, { error }) => ({
    ...state,
    currentCandidate: null,
    isAuthenticated: false,
    loading: false,
    error,
  })),
  on(CandidateAuthActions.logout, () => initialCandidateAuthState),
);

export const candidateAuthFeature = createFeature({
  name: 'candidateAuth',
  reducer: candidateAuthReducer,
});
