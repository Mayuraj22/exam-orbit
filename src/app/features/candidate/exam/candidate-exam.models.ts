/** A question as the candidate sees it: no correct answer, already in this attempt's order. */
export interface ExamQuestion {
  id: string;
  text: string;
  type: 'mcq' | 'input';
  options: { id: string; text: string }[] | null;
}

export interface ExamAttempt {
  attempt_number: number;
  deadline_at: string;
  /** Server clock when the attempt was loaded, to correct for a wrong local clock. */
  server_now: string;
  /** question id → answer saved so far (MCQ: option id). */
  answers: Record<string, string>;
  violation_count: number;
}

export interface ExamProctoringSettings {
  camera_required: boolean;
  max_warnings: number;
  snapshot_interval_seconds: number;
}

export type StartExamStatus = 'ok' | 'expired' | 'not_published' | 'already_attempted' | 'time_up';

export interface StartExamResult {
  status: StartExamStatus;
  attempt?: ExamAttempt;
  settings?: ExamProctoringSettings;
  questions?: ExamQuestion[];
}

export type SaveAnswerStatus = 'ok' | 'not_in_progress' | 'time_up' | 'invalid_question';

/** Things the proctoring layer reports. */
export type ViolationType =
  'no_face' | 'multiple_faces' | 'tab_switch' | 'fullscreen_exit' | 'camera_blocked' | 'copy_paste';

export interface LogEventResult {
  status: 'ok' | 'not_in_progress' | 'invalid_event' | 'invalid_snapshot';
  violation_count?: number;
  /** 1, 2… while within the allowed warnings; null once over. */
  warning_number?: number | null;
  max_warnings?: number;
  /** The server submitted the exam because of too many violations. */
  terminated?: boolean;
}

/** Plain-language text for each violation, shown in the warning. */
export const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  no_face: "We can't see your face. Stay in front of the camera.",
  multiple_faces: 'More than one person is in view. Only you may be in the camera.',
  tab_switch: 'You left the exam page. Stay on this page until you submit.',
  fullscreen_exit: 'You left fullscreen. The exam must stay in fullscreen.',
  camera_blocked: 'Your camera was turned off. Keep it on for the whole exam.',
  copy_paste: 'Copying, pasting and right-clicking are not allowed during the exam.',
};
