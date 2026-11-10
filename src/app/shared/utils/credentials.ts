// Avoids look-alike characters (0/O, 1/I/L) so passcodes are easy to read out.
const PASSCODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Random 6-character passcode, e.g. "K7QM3X". Uses the browser's secure RNG. */
export function generatePasscode(length = 6): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSCODE_CHARS[b % PASSCODE_CHARS.length]).join('');
}

/**
 * Username from a name: "Priya Sharma" → "priya.sharma", made unique
 * against `taken` by adding a number ("priya.sharma2").
 */
export function generateUsername(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('.') || 'candidate';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/** Usernames: 3–40 chars of letters, digits, dot, dash, underscore. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;
