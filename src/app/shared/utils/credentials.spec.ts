import { generatePasscode, generateUsername, USERNAME_PATTERN } from './credentials';

describe('credentials', () => {
  it('generates 6-character passcodes without look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePasscode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it('builds a username from the first two name parts', () => {
    expect(generateUsername('Priya Sharma', new Set())).toBe('priya.sharma');
    expect(generateUsername('Ana María López', new Set())).toBe('ana.maria');
  });

  it('adds a number when the username is taken', () => {
    const taken = new Set(['priya.sharma', 'priya.sharma2']);
    expect(generateUsername('Priya Sharma', taken)).toBe('priya.sharma3');
  });

  it('falls back to "candidate" for names without letters', () => {
    expect(generateUsername('***', new Set())).toBe('candidate');
  });

  it('generated usernames pass validation', () => {
    expect(USERNAME_PATTERN.test(generateUsername('Priya Sharma', new Set()))).toBe(true);
    expect(USERNAME_PATTERN.test('BAD USER!')).toBe(false);
  });
});
