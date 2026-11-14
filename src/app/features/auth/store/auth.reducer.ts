import { createFeature, createReducer, on } from '@ngrx/store';
import { CandidateAuthActions } from './auth.actions';
import { CandidateAuthState, initialCandidateAuthState } from './auth.state';
import { CandidateLoginResult } from '../../../shared/models/candidate-session.model';

const applyResult = (
  state: CandidateAuthState,
  result: CandidateLoginResult,
): CandidateAuthState => ({
  ...state,
  status: result.status,
  session:
    result.candidate && result.exam ? { candidate: result.candidate, exam: result.exam } : null,
  isAuthenticated: result.status === 'ok',
  loading: false,
  error: null,
  restored: true,
});

const candidateAuthReducer = createReducer(
  initialCandidateAuthState,
  on(CandidateAuthActions.login, CandidateAuthActions.restoreSession, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(CandidateAuthActions.loginResult, (state, { result }) => applyResult(state, result)),
  on(CandidateAuthActions.restoreSessionResult, (state, { result }) =>
    result ? applyResult(state, result) : { ...state, loading: false, restored: true },
  ),
  on(CandidateAuthActions.loginFailure, (state, { error }) => ({
    ...state,
    loading: false,
    isAuthenticated: false,
    error,
    restored: true,
  })),
  on(CandidateAuthActions.logout, CandidateAuthActions.examFinished, () => ({
    ...initialCandidateAuthState,
    restored: true,
  })),
);

export const candidateAuthFeature = createFeature({
  name: 'candidateAuth',
  reducer: candidateAuthReducer,
});
