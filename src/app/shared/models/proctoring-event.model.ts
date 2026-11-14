export type ProctoringEventType =
  | 'exam_started'
  | 'snapshot'
  | 'no_face'
  | 'multiple_faces'
  | 'tab_switch'
  | 'fullscreen_exit'
  | 'camera_blocked'
  | 'copy_paste'
  | 'auto_submitted';

export interface ProctoringEvent {
  id: string;
  exam_id: string;
  candidate_id: string;
  result_id: string | null;
  attempt_number: number;
  occurred_at: string;
  event_type: ProctoringEventType;
  /** 1, 2... when this violation produced a warning. */
  warning_number: number | null;
  /** Path in the private snapshot bucket; null if none or deleted after 30 days. */
  snapshot_path: string | null;
  details: Record<string, unknown> & { snapshot_deleted_at?: string };
}
