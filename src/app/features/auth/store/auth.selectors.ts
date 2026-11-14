import { candidateAuthFeature } from './auth.reducer';

export const selectCandidateSession = candidateAuthFeature.selectSession;
export const selectLoginStatus = candidateAuthFeature.selectStatus;
export const selectIsAuthenticated = candidateAuthFeature.selectIsAuthenticated;
export const selectAuthLoading = candidateAuthFeature.selectLoading;
export const selectAuthError = candidateAuthFeature.selectError;
export const selectSessionRestored = candidateAuthFeature.selectRestored;
