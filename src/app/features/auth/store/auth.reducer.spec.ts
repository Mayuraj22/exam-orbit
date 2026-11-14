import { CandidateAuthActions as A } from './auth.actions';
import { candidateAuthFeature } from './auth.reducer';
import { initialCandidateAuthState } from './auth.state';
import { CandidateLoginResult } from '../../../shared/models/candidate-session.model';

const reducer = candidateAuthFeature.reducer;

const info = {
  candidate: { id: 'c1', name: 'Priya Sharma', username: 'priya.sharma' },
  exam: {
    id: 'e1',
    title: 'JS basics',
    description: null,
    duration_minutes: 60,
    pass_mark: 60,
    camera_required: true,
    max_warnings: 2,
    question_count: 20,
  },
};

describe('candidateAuth reducer', () => {
  it('signs in on an ok result', () => {
    const result: CandidateLoginResult = { status: 'ok', token: 't', ...info };
    let state = reducer(initialCandidateAuthState, A.login({ username: 'u', passcode: 'p' }));
    expect(state.loading).toBe(true);

    state = reducer(state, A.loginResult({ result }));
    expect(state.isAuthenticated).toBe(true);
    expect(state.session?.candidate.name).toBe('Priya Sharma');
    expect(state.loading).toBe(false);
  });

  it('stays signed out on a wrong passcode', () => {
    const state = reducer(
      initialCandidateAuthState,
      A.loginResult({ result: { status: 'invalid' } }),
    );
    expect(state.isAuthenticated).toBe(false);
    expect(state.status).toBe('invalid');
    expect(state.session).toBeNull();
  });

  it('keeps exam details for "already attempted" but does not sign in', () => {
    const state = reducer(
      initialCandidateAuthState,
      A.loginResult({ result: { status: 'already_attempted', ...info } }),
    );
    expect(state.isAuthenticated).toBe(false);
    expect(state.session?.exam.title).toBe('JS basics');
  });

  it('marks the session as checked when there was nothing to restore', () => {
    const state = reducer(initialCandidateAuthState, A.restoreSessionResult({ result: null }));
    expect(state.restored).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  it('records a server error separately from a wrong passcode', () => {
    const state = reducer(initialCandidateAuthState, A.loginFailure({ error: 'offline' }));
    expect(state.error).toBe('offline');
    expect(state.status).toBeNull();
  });

  it('clears everything on logout', () => {
    let state = reducer(
      initialCandidateAuthState,
      A.loginResult({ result: { status: 'ok', token: 't', ...info } }),
    );
    state = reducer(state, A.logout());
    expect(state.isAuthenticated).toBe(false);
    expect(state.session).toBeNull();
  });
});
