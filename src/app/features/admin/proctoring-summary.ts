import { ProctoringEvent, ProctoringEventType } from '../../shared/models/proctoring-event.model';

export const VIOLATION_TYPES = [
  'no_face',
  'multiple_faces',
  'tab_switch',
  'fullscreen_exit',
  'camera_blocked',
  'copy_paste',
] as const satisfies readonly ProctoringEventType[];

export type ViolationEventType = (typeof VIOLATION_TYPES)[number];

/** How each event reads in the admin timeline. */
export const EVENT_LABELS: Record<ProctoringEventType, string> = {
  exam_started: 'Exam started',
  snapshot: 'Routine photo',
  no_face: 'Face not visible',
  multiple_faces: 'More than one person',
  tab_switch: 'Left the exam page',
  fullscreen_exit: 'Left fullscreen',
  camera_blocked: 'Camera turned off',
  copy_paste: 'Copy, paste or right-click',
  auto_submitted: 'Exam auto-submitted',
};

export const EVENT_ICONS: Record<ProctoringEventType, string> = {
  exam_started: 'play_circle',
  snapshot: 'photo_camera',
  no_face: 'face_retouching_off',
  multiple_faces: 'group',
  tab_switch: 'tab',
  fullscreen_exit: 'fullscreen_exit',
  camera_blocked: 'videocam_off',
  copy_paste: 'content_paste_off',
  auto_submitted: 'gpp_bad',
};

export const isViolation = (type: ProctoringEventType): type is ViolationEventType =>
  (VIOLATION_TYPES as readonly string[]).includes(type);

export interface TimelineEntry {
  event: ProctoringEvent;
  label: string;
  icon: string;
  violation: boolean;
  /** Time since the exam started, e.g. "12 min" or "45 s". */
  elapsed: string;
  /** The photo existed but was removed after the retention period. */
  snapshotDeleted: boolean;
}

export interface ProctoringSummary {
  violations: number;
  /** Count per violation type that occurred, most frequent first. */
  byType: { type: ViolationEventType; label: string; count: number }[];
  autoSubmitted: boolean;
  snapshots: number;
  startedAt: string | null;
}

export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/** Events in time order, labelled, with time since the exam started. */
export function buildTimeline(events: readonly ProctoringEvent[]): TimelineEntry[] {
  const sorted = [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const start = sorted.find((e) => e.event_type === 'exam_started') ?? sorted[0];
  const startMs = start ? Date.parse(start.occurred_at) : 0;
  return sorted.map((event) => ({
    event,
    label: EVENT_LABELS[event.event_type] ?? event.event_type,
    icon: EVENT_ICONS[event.event_type] ?? 'info',
    violation: isViolation(event.event_type),
    elapsed: formatElapsed(Date.parse(event.occurred_at) - startMs),
    snapshotDeleted: !event.snapshot_path && !!event.details?.snapshot_deleted_at,
  }));
}

export function summarize(events: readonly ProctoringEvent[]): ProctoringSummary {
  const counts = new Map<ViolationEventType, number>();
  for (const e of events) {
    if (isViolation(e.event_type)) counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
  }
  const byType = [...counts.entries()]
    .map(([type, count]) => ({ type, label: EVENT_LABELS[type], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const started = events.find((e) => e.event_type === 'exam_started');
  return {
    violations: byType.reduce((sum, t) => sum + t.count, 0),
    byType,
    autoSubmitted: events.some((e) => e.event_type === 'auto_submitted'),
    snapshots: events.filter((e) => !!e.snapshot_path).length,
    startedAt: started?.occurred_at ?? null,
  };
}
