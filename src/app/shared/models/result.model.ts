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
  proctoring_video_path?: string | null;
}
