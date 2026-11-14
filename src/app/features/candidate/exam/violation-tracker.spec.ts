import { ViolationTracker } from './violation-tracker';

describe('ViolationTracker', () => {
  let tracker: ViolationTracker;

  beforeEach(() => {
    tracker = new ViolationTracker({ noFaceMs: 5000, multipleFacesMs: 3000, cooldownMs: 10000 });
  });

  it('ignores a face that disappears briefly', () => {
    expect(tracker.observeFaces(0, 0)).toBeNull();
    expect(tracker.observeFaces(0, 4000)).toBeNull();
    expect(tracker.observeFaces(1, 4500)).toBeNull(); // back in view: timer resets
    expect(tracker.observeFaces(0, 6000)).toBeNull();
    expect(tracker.observeFaces(0, 10000)).toBeNull(); // only 4 s since it disappeared again
  });

  it('reports no face after 5 seconds', () => {
    tracker.observeFaces(0, 0);
    expect(tracker.observeFaces(0, 5000)).toBe('no_face');
  });

  it('reports multiple faces after 3 seconds', () => {
    tracker.observeFaces(2, 0);
    expect(tracker.observeFaces(2, 2999)).toBeNull();
    expect(tracker.observeFaces(2, 3000)).toBe('multiple_faces');
  });

  it('reports tab switches immediately', () => {
    expect(tracker.observeEvent('tab_switch', 0)).toBe('tab_switch');
  });

  it('does not count anything during the cool-down', () => {
    expect(tracker.observeEvent('tab_switch', 0)).toBe('tab_switch');
    expect(tracker.observeEvent('fullscreen_exit', 1000)).toBeNull();
    tracker.observeFaces(0, 1000);
    expect(tracker.observeFaces(0, 9000)).toBeNull();
    expect(tracker.inCooldown(9999)).toBe(true);
    expect(tracker.observeEvent('copy_paste', 10000)).toBe('copy_paste');
  });

  it('counts a continuing problem again only after the cool-down', () => {
    tracker.observeFaces(0, 0);
    expect(tracker.observeFaces(0, 5000)).toBe('no_face');
    // Still no face (checked every ~500 ms); timing restarts at the next check.
    expect(tracker.observeFaces(0, 5500)).toBeNull();
    expect(tracker.observeFaces(0, 14000)).toBeNull(); // still in the 10 s cool-down
    expect(tracker.observeFaces(0, 15000)).toBe('no_face');
  });

  it('ignores a single snapshot of no face right after starting', () => {
    expect(tracker.observeFaces(0, 0)).toBeNull();
  });
});
