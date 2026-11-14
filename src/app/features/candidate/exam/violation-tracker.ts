import { ViolationType } from './candidate-exam.models';

export interface ViolationRules {
  /** No face for this long counts as a violation (glitches are ignored). */
  noFaceMs: number;
  /** More than one face for this long counts. */
  multipleFacesMs: number;
  /** After a violation, nothing else counts for this long (one problem ≠ several warnings). */
  cooldownMs: number;
}

export const DEFAULT_RULES: ViolationRules = {
  noFaceMs: 5000,
  multipleFacesMs: 3000,
  cooldownMs: 10000,
};

/**
 * Decides when observations become violations. Pure logic (time is passed in),
 * so the rules are easy to test and to tune.
 *
 * - Face problems must last a while: a blink, a head turn or a bad frame isn't cheating.
 * - Deliberate actions (tab switch, leaving fullscreen, camera off, copy/paste) count at once.
 * - After any violation, a cool-down stops one problem from using up every warning.
 */
export class ViolationTracker {
  private noFaceSince: number | null = null;
  private multipleSince: number | null = null;
  private cooldownUntil = 0;

  constructor(private readonly rules: ViolationRules = DEFAULT_RULES) {}

  /** Feed the latest face count (from detection). Returns a violation when one is due. */
  observeFaces(faceCount: number, now: number): ViolationType | null {
    this.noFaceSince = faceCount === 0 ? (this.noFaceSince ?? now) : null;
    this.multipleSince = faceCount > 1 ? (this.multipleSince ?? now) : null;

    if (this.multipleSince !== null && now - this.multipleSince >= this.rules.multipleFacesMs) {
      return this.trigger('multiple_faces', now);
    }
    if (this.noFaceSince !== null && now - this.noFaceSince >= this.rules.noFaceMs) {
      return this.trigger('no_face', now);
    }
    return null;
  }

  /** Deliberate actions count immediately (unless in the cool-down). */
  observeEvent(
    type: Exclude<ViolationType, 'no_face' | 'multiple_faces'>,
    now: number,
  ): ViolationType | null {
    return this.trigger(type, now);
  }

  inCooldown(now: number): boolean {
    return now < this.cooldownUntil;
  }

  private trigger(type: ViolationType, now: number): ViolationType | null {
    if (this.inCooldown(now)) return null;
    this.cooldownUntil = now + this.rules.cooldownMs;
    // Start timing afresh, so a continuing problem needs the full duration again.
    this.noFaceSince = null;
    this.multipleSince = null;
    return type;
  }
}
