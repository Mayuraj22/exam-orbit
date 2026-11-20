import { ViolationType } from './candidate-exam.models';

export interface ViolationRules {
  /** No face for this long counts as a violation (glitches are ignored). */
  noFaceMs: number;
  /** More than one face for this long counts. */
  multipleFacesMs: number;
  /** Face partly out of frame (or too far away) for this long counts. */
  partialFaceMs: number;
  /** After a violation, nothing else counts for this long (one problem ≠ several warnings). */
  cooldownMs: number;
}

export const DEFAULT_RULES: ViolationRules = {
  noFaceMs: 5000,
  multipleFacesMs: 3000,
  partialFaceMs: 4000,
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
  private partialSince: number | null = null;
  private cooldownUntil = 0;

  constructor(private readonly rules: ViolationRules = DEFAULT_RULES) {}

  /**
   * Feed the latest detection: how many faces, and whether the single face is
   * only partly in frame. Returns a violation when one is due.
   */
  observeFaces(faceCount: number, now: number, partial = false): ViolationType | null {
    this.noFaceSince = faceCount === 0 ? (this.noFaceSince ?? now) : null;
    this.multipleSince = faceCount > 1 ? (this.multipleSince ?? now) : null;
    this.partialSince = faceCount === 1 && partial ? (this.partialSince ?? now) : null;

    if (this.multipleSince !== null && now - this.multipleSince >= this.rules.multipleFacesMs) {
      return this.trigger('multiple_faces', now);
    }
    if (this.noFaceSince !== null && now - this.noFaceSince >= this.rules.noFaceMs) {
      return this.trigger('no_face', now);
    }
    if (this.partialSince !== null && now - this.partialSince >= this.rules.partialFaceMs) {
      return this.trigger('face_partial', now);
    }
    return null;
  }

  /** Deliberate actions count immediately (unless in the cool-down). */
  observeEvent(
    type: Exclude<ViolationType, 'no_face' | 'multiple_faces' | 'face_partial'>,
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
    this.partialSince = null;
    return type;
  }
}
