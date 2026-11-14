import { buildTimeline, formatElapsed, summarize } from './proctoring-summary';
import { ProctoringEvent, ProctoringEventType } from '../../shared/models/proctoring-event.model';

let seq = 0;
const ev = (
  type: ProctoringEventType,
  at: string,
  extra: Partial<ProctoringEvent> = {},
): ProctoringEvent => ({
  id: `e${++seq}`,
  exam_id: 'x',
  candidate_id: 'c',
  result_id: 'r',
  attempt_number: 1,
  occurred_at: at,
  event_type: type,
  warning_number: null,
  snapshot_path: null,
  details: {},
  ...extra,
});

const T = (min: number, sec = 0) => new Date(Date.UTC(2026, 0, 1, 10, min, sec)).toISOString();

describe('proctoring summary', () => {
  const events = [
    ev('tab_switch', T(12), { warning_number: 1, snapshot_path: 'a.jpg' }),
    ev('exam_started', T(0)),
    ev('snapshot', T(1, 30), { snapshot_path: 'b.jpg' }),
    ev('no_face', T(20), { warning_number: 2 }),
    ev('tab_switch', T(25)),
    ev('auto_submitted', T(25)),
  ];

  it('orders the timeline and measures time from the start', () => {
    const timeline = buildTimeline(events);
    expect(timeline.map((t) => t.event.event_type)).toEqual([
      'exam_started',
      'snapshot',
      'tab_switch',
      'no_face',
      'tab_switch',
      'auto_submitted',
    ]);
    expect(timeline[1].elapsed).toBe('1 min');
    expect(timeline[2].elapsed).toBe('12 min');
    expect(timeline[2].violation).toBe(true);
    expect(timeline[1].violation).toBe(false);
  });

  it('counts violations by type, most frequent first', () => {
    const summary = summarize(events);
    expect(summary.violations).toBe(3);
    expect(summary.byType[0]).toEqual({
      type: 'tab_switch',
      label: 'Left the exam page',
      count: 2,
    });
    expect(summary.autoSubmitted).toBe(true);
    expect(summary.snapshots).toBe(2);
  });

  it('marks photos removed after the retention period', () => {
    const [entry] = buildTimeline([
      ev('snapshot', T(0), { details: { snapshot_deleted_at: T(30) } }),
    ]);
    expect(entry.snapshotDeleted).toBe(true);
  });

  it('formats elapsed time', () => {
    expect(formatElapsed(45_000)).toBe('45 s');
    expect(formatElapsed(12 * 60_000)).toBe('12 min');
    expect(formatElapsed(75 * 60_000)).toBe('1 h 15 min');
    expect(formatElapsed(-5)).toBe('0 s');
  });

  it('handles an attempt with no events', () => {
    expect(summarize([])).toEqual({
      violations: 0,
      byType: [],
      autoSubmitted: false,
      snapshots: 0,
      startedAt: null,
    });
  });
});
