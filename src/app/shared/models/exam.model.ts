/** Per-exam options (Phase 6). */
export interface ExamSettings {
  /** Minimum percentage to pass; null = no pass mark. */
  pass_mark: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  /** Candidates must keep their webcam on (snapshots + warnings). */
  camera_required: boolean;
  /** Warnings before the exam is auto-submitted; the next violation ends it. */
  max_warnings: number;
  /** Seconds between routine webcam snapshots. */
  snapshot_interval_seconds: number;
}

export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  pass_mark: null,
  shuffle_questions: false,
  shuffle_options: false,
  camera_required: false,
  max_warnings: 2,
  snapshot_interval_seconds: 90,
};

/** Fields needed to create an exam; settings left out use the database defaults. */
export type NewExam = Pick<Exam, 'title' | 'description' | 'duration_minutes' | 'is_published'> &
  Partial<ExamSettings>;

export interface Exam extends ExamSettings {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
}
