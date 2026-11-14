export type ReviewStatus = 'cleared' | 'suspicious' | 'disqualified';

export interface Result {
  id: string;
  candidate_id: string;
  exam_id: string;
  /** question id → answer (MCQ: chosen option id; Input: typed text). */
  answers: Record<string, string>;
  /** Number of correct answers. */
  score: number | null;
  submitted_at: string;
  /** question id → marked correct? Filled by auto-grading and the admin. */
  graded_answers: Record<string, boolean> | null;
  is_fully_graded: boolean;
  /** 1 for the first attempt; increases after "Reset attempt". */
  attempt_number: number;
  /** Proctoring violations recorded during this attempt. */
  violation_count: number;
  /** The exam was auto-submitted after too many violations. */
  terminated_by_proctoring: boolean;
  /** Admin's proctoring decision; null = not reviewed. */
  review_status: ReviewStatus | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  /** @deprecated Full video recording was replaced by snapshots (proctoring_events). */
  proctoring_video_path?: string | null;
}

export const DEFAULT_RESULT_FIELDS: Pick<
  Result,
  | 'attempt_number'
  | 'violation_count'
  | 'terminated_by_proctoring'
  | 'review_status'
  | 'review_note'
  | 'reviewed_at'
  | 'reviewed_by'
> = {
  attempt_number: 1,
  violation_count: 0,
  terminated_by_proctoring: false,
  review_status: null,
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

/** Flagged by proctoring and not yet decided by an admin. */
export const needsProctoringReview = (r: Result): boolean =>
  (r.terminated_by_proctoring || r.violation_count > 0) && !r.review_status;
