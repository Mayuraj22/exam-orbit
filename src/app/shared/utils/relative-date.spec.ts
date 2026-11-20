import { initials, relativeDate } from './relative-date';

describe('relativeDate', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('shows recent times in words', () => {
    expect(relativeDate(ago(10_000), now)).toBe('Just now');
    expect(relativeDate(ago(5 * 60_000), now)).toBe('5 min ago');
    expect(relativeDate(ago(3 * 3_600_000), now)).toBe('3 h ago');
    expect(relativeDate(ago(26 * 3_600_000), now)).toBe('Yesterday');
    expect(relativeDate(ago(6 * 86_400_000), now)).toBe('6 days ago');
  });

  it('shows older dates as a short date, with the year only when different', () => {
    expect(relativeDate('2026-09-10T10:00:00Z', now)).toMatch(/Sep/);
    expect(relativeDate('2026-09-10T10:00:00Z', now)).not.toMatch(/2026/);
    expect(relativeDate('2025-09-10T10:00:00Z', now)).toMatch(/2025/);
  });
});

describe('initials', () => {
  it('uses the first letters of two names, or two letters of one', () => {
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('sam')).toBe('SA');
    expect(initials('  ')).toBe('?');
  });
});
