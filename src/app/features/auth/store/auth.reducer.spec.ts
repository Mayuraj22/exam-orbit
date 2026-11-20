import { CandidateAuthActions as A } from './auth.actions';
import { candidateAuthFeature } from './auth.reducer';
import { initialCandidateAuthState } from './auth.state';
import { CandidateLoginResult } from '../../../shared/models/candidate-session.model';

const reducer = candidateAuthFeature.reducer;

const candidate = { id: 'c1', name: 'Priya Sharma', username: 'priya.sharma' };

describe('candidateAuth reducer', () => {
  it('signs in on an ok result', () => {
    const result: CandidateLoginResult = { status: 'ok', token: 't', candidate };
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

  it('stays signed out when locked out', () => {
    const state = reducer(
      initialCandidateAuthState,
      A.loginResult({ result: { status: 'too_many_attempts' } }),
    );
    expect(state.isAuthenticated).toBe(false);
    expect(state.status).toBe('too_many_attempts');
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
      A.loginResult({ result: { status: 'ok', token: 't', candidate } }),
    );
    state = reducer(state, A.logout());
    expect(state.isAuthenticated).toBe(false);
    expect(state.session).toBeNull();
  });
});
