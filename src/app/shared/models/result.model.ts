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
  /** @deprecated Full video recording was replaced by snapshots (proctoring_events). */
  proctoring_video_path?: string | null;
}

export const DEFAULT_RESULT_FIELDS: Pick<
  Result,
  'attempt_number' | 'violation_count' | 'terminated_by_proctoring'
> = {
  attempt_number: 1,
  violation_count: 0,
  terminated_by_proctoring: false,
};
