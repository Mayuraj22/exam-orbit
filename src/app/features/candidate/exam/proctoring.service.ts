import { DOCUMENT, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import { CandidateExamService } from './candidate-exam.service';
import { LogEventResult, ViolationType } from './candidate-exam.models';
import { ViolationTracker } from './violation-tracker';

export type CameraState = 'idle' | 'starting' | 'on' | 'denied' | 'not_found' | 'off' | 'error';
export type DetectorState = 'idle' | 'loading' | 'ready' | 'unavailable';
export type Lighting = 'unknown' | 'ok' | 'dark';

export interface ProctoringWarning {
  type: ViolationType;
  result: LogEventResult;
}

/** Google's published face model (≈ 230 KB, cached by the browser after the first load). */
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const ANALYSIS_INTERVAL_MS = 500;
/** Give up on face detection after this long (blocked network, old browser…). */
const DETECTOR_TIMEOUT_MS = 15000;
/** Consecutive failed frames before face detection is treated as broken. */
const MAX_DETECTION_FAILURES = 20;
const SNAPSHOT_WIDTH = 320;
const SNAPSHOT_HEIGHT = 240;

/**
 * Webcam + proctoring for one exam sitting. Provided on the candidate routes,
 * so the camera stays on from the camera check into the exam.
 *
 * Everything runs in the browser: face detection uses MediaPipe locally, and
 * only small JPEG snapshots (routine + at each violation) are uploaded.
 */
@Injectable()
export class ProctoringService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(CandidateExamService);

  readonly cameraState = signal<CameraState>('idle');
  readonly detectorState = signal<DetectorState>('idle');
  /** Faces in the latest frame; null until detection is running. */
  readonly faceCount = signal<number | null>(null);
  readonly lighting = signal<Lighting>('unknown');
  readonly stream = signal<MediaStream | null>(null);

  /** Violations the server has recorded (with warning number / termination). */
  readonly warnings$ = new Subject<ProctoringWarning>();

  private video: HTMLVideoElement | null = null;
  private detector: FaceDetector | null = null;
  private analysisTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private tracker = new ViolationTracker();
  private monitoring: { attemptNumber: number } | null = null;
  private removeListeners: (() => void) | null = null;
  private reporting = false;

  // ---------------------------------------------------------------------------
  // Camera and detector
  // ---------------------------------------------------------------------------

  async startCamera(): Promise<CameraState> {
    if (this.cameraState() === 'on') return 'on';
    this.cameraState.set('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      this.stream.set(stream);

      // A hidden <video> that detection and snapshots read from.
      const video = this.document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      this.video = video;

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.cameraState.set('off');
        this.faceCount.set(0);
        this.event('camera_blocked');
      });

      this.cameraState.set('on');
      this.startAnalysis();
    } catch (error) {
      const name = (error as DOMException)?.name;
      this.cameraState.set(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'not_found'
            : 'error',
      );
    }
    return this.cameraState();
  }

  /** Loads face detection on demand (only exam pages download it). */
  async loadDetector(): Promise<DetectorState> {
    if (this.detectorState() === 'ready' || this.detectorState() === 'loading') {
      return this.detectorState();
    }
    this.detectorState.set('loading');
    try {
      const load = (async () => {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        return FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
      })();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Face detection took too long to load')),
          DETECTOR_TIMEOUT_MS,
        ),
      );
      this.detector = await Promise.race([load, timeout]);
      this.detectorState.set('ready');
    } catch (error) {
      console.warn('[proctoring] face detection unavailable:', error);
      // Offline or blocked: snapshots and browser checks still work.
      this.detectorState.set('unavailable');
    }
    return this.detectorState();
  }

  /** Samples the camera twice a second: face count, lighting, and (when monitoring) violations. */
  private startAnalysis(): void {
    if (this.analysisTimer) return;
    const tiny = this.document.createElement('canvas');
    tiny.width = 32;
    tiny.height = 24;
    const ctx = tiny.getContext('2d', { willReadFrequently: true });
    let failures = 0;

    this.analysisTimer = setInterval(() => {
      const video = this.video;
      if (!video || video.readyState < 2 || this.cameraState() !== 'on') return;

      if (ctx) {
        ctx.drawImage(video, 0, 0, tiny.width, tiny.height);
        const { data } = ctx.getImageData(0, 0, tiny.width, tiny.height);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        this.lighting.set(sum / (data.length / 4) < 50 ? 'dark' : 'ok');
      }

      if (this.detector) {
        try {
          const faces = this.detector.detectForVideo(video, performance.now()).detections.length;
          failures = 0;
          this.faceCount.set(faces);
          if (this.monitoring) {
            const violation = this.tracker.observeFaces(faces, Date.now());
            if (violation) this.report(violation, { faces });
          }
        } catch (error) {
          // A dropped frame isn't a problem; constant failures mean detection is broken.
          if (++failures >= MAX_DETECTION_FAILURES) {
            console.warn('[proctoring] face detection keeps failing:', error);
            this.detector = null;
            this.detectorState.set('unavailable');
          }
        }
      }
    }, ANALYSIS_INTERVAL_MS);
  }

  // ---------------------------------------------------------------------------
  // Monitoring during the exam
  // ---------------------------------------------------------------------------

  /** Starts violation checks, routine snapshots and browser-event listeners. */
  startMonitoring(attemptNumber: number, snapshotIntervalSeconds: number): void {
    if (this.monitoring) return;
    this.monitoring = { attemptNumber };
    this.tracker = new ViolationTracker();

    // An immediate snapshot as the identity reference, then on the interval.
    void this.routineSnapshot();
    this.snapshotTimer = setInterval(
      () => void this.routineSnapshot(),
      Math.max(30, snapshotIntervalSeconds) * 1000,
    );

    const doc = this.document;
    const win = doc.defaultView!;
    const onVisibility = () => {
      if (doc.visibilityState === 'hidden') this.event('tab_switch', { reason: 'tab_hidden' });
    };
    const onBlur = () => {
      // Window lost focus (another app or window). Ignore if focus stays inside the page.
      setTimeout(() => {
        if (!doc.hasFocus() && doc.visibilityState === 'visible') {
          this.event('tab_switch', { reason: 'window_blur' });
        }
      }, 300);
    };
    const onFullscreen = () => {
      if (!doc.fullscreenElement) this.event('fullscreen_exit');
    };
    const onCopy = (e: Event) => {
      e.preventDefault();
      this.event('copy_paste', { action: e.type });
    };

    doc.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('blur', onBlur);
    doc.addEventListener('fullscreenchange', onFullscreen);
    for (const type of ['copy', 'cut', 'paste', 'contextmenu']) doc.addEventListener(type, onCopy);

    this.removeListeners = () => {
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('blur', onBlur);
      doc.removeEventListener('fullscreenchange', onFullscreen);
      for (const type of ['copy', 'cut', 'paste', 'contextmenu'])
        doc.removeEventListener(type, onCopy);
    };
  }

  private event(type: Exclude<ViolationType, 'no_face' | 'multiple_faces'>, details = {}): void {
    if (!this.monitoring) return;
    const violation = this.tracker.observeEvent(type, Date.now());
    if (violation) this.report(violation, details);
  }

  /** Snapshot (if the camera is on) → server records it → UI is told the outcome. */
  private async report(type: ViolationType, details: Record<string, unknown> = {}): Promise<void> {
    if (!this.monitoring) return;
    if (this.reporting) return; // one at a time; the cool-down covers the rest
    this.reporting = true;
    try {
      const path = await this.captureAndUpload();
      const result = await this.api.logEvent(type, path, details);
      if (result.status === 'ok') this.warnings$.next({ type, result });
    } catch {
      /* network hiccup: the next violation will still be recorded */
    } finally {
      this.reporting = false;
    }
  }

  private async routineSnapshot(): Promise<void> {
    if (!this.monitoring || this.cameraState() !== 'on') return;
    const path = await this.captureAndUpload();
    if (path) await this.api.logEvent('snapshot', path).catch(() => undefined);
  }

  private async captureAndUpload(): Promise<string | null> {
    if (!this.monitoring || !this.video || this.cameraState() !== 'on') return null;
    const canvas = this.document.createElement('canvas');
    canvas.width = SNAPSHOT_WIDTH;
    canvas.height = SNAPSHOT_HEIGHT;
    canvas.getContext('2d')?.drawImage(this.video, 0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.7),
    );
    return blob ? this.api.uploadSnapshot(blob, this.monitoring.attemptNumber) : null;
  }

  // ---------------------------------------------------------------------------

  /** Turns everything off (exam finished, or leaving the candidate area). */
  stop(): void {
    this.monitoring = null;
    this.removeListeners?.();
    this.removeListeners = null;
    if (this.analysisTimer) clearInterval(this.analysisTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.analysisTimer = null;
    this.snapshotTimer = null;
    this.stream()
      ?.getTracks()
      .forEach((t) => t.stop());
    this.stream.set(null);
    if (this.video) this.video.srcObject = null;
    this.video = null;
    this.cameraState.set('idle');
    this.faceCount.set(null);
    this.lighting.set('unknown');
  }

  ngOnDestroy(): void {
    this.stop();
    this.detector?.close();
  }
}
