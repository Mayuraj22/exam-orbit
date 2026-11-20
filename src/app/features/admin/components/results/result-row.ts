import { Result } from '../../../../shared/models/result.model';
import { ResultOutcome } from '../../grading';

export type GradingStatus = 'graded' | 'needs-grading';

/** The single label shown for a result. */
export type ResultBadge = 'disqualified' | 'needs-grading' | 'pass' | 'fail' | 'graded';

export const BADGE_LABELS: Record<ResultBadge, string> = {
  disqualified: 'Disqualified',
  'needs-grading': 'To grade',
  pass: 'Passed',
  fail: 'Failed',
  graded: 'Graded',
};

/** One label per result: the most important fact wins. */
export function badgeFor(outcome: ResultOutcome | null, status: GradingStatus): ResultBadge {
  if (outcome === 'disqualified') return 'disqualified';
  if (status === 'needs-grading') return 'needs-grading';
  if (outcome === 'pass' || outcome === 'fail') return outcome;
  return 'graded';
}

/** A result plus everything the Results screens display about it. */
export interface ResultRow extends Result {
  candidateName: string;
  candidateUsername: string;
  examTitle: string;
  initials: string;
  /** Number of questions, when this exam's questions are loaded. */
  total: number | null;
  percent: number | null;
  status: GradingStatus;
  /** null when the exam has no pass mark (or the percentage is unknown). */
  outcome: ResultOutcome | null;
  needsReview: boolean;
  badge: ResultBadge;
  submittedLabel: string;
  passMark: number | null;
}
