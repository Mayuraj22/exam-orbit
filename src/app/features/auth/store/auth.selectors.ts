import { candidateAuthFeature } from './auth.reducer';

export const selectCurrentCandidate = candidateAuthFeature.selectCurrentCandidate;
export const selectIsAuthenticated = candidateAuthFeature.selectIsAuthenticated;
export const selectAuthLoading = candidateAuthFeature.selectLoading;
export const selectAuthError = candidateAuthFeature.selectError;
