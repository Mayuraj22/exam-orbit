import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProctoringService } from '../exam/proctoring.service';

type CheckState = 'pass' | 'warn' | 'fail' | 'pending';

interface Check {
  label: string;
  state: CheckState;
  help?: string;
}

/** /exam/check: webcam preview and checks before a proctored exam starts. */
@Component({
  selector: 'app-camera-check',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './camera-check.component.html',
  styleUrl: './camera-check.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraCheckComponent implements OnInit {
  protected readonly proctoring = inject(ProctoringService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly preview = viewChild<ElementRef<HTMLVideoElement>>('preview');

  protected readonly starting = signal(false);

  protected readonly checks = computed<Check[]>(() => {
    const camera = this.proctoring.cameraState();
    const detector = this.proctoring.detectorState();
    const faces = this.proctoring.faceCount();
    const lighting = this.proctoring.lighting();

    const cameraCheck: Check =
      camera === 'on'
        ? { label: 'Camera allowed', state: 'pass' }
        : camera === 'denied'
          ? {
              label: 'Camera blocked',
              state: 'fail',
              help: 'Click the camera icon in your browser’s address bar, choose Allow, then Try again.',
            }
          : camera === 'not_found'
            ? { label: 'No camera found', state: 'fail', help: 'Connect a webcam, then Try again.' }
            : camera === 'error' || camera === 'off'
              ? {
                  label: 'Camera not available',
                  state: 'fail',
                  help: 'Close other apps that use the camera, then Try again.',
                }
              : { label: 'Starting camera…', state: 'pending' };

    let faceCheck: Check;
    if (camera !== 'on') faceCheck = { label: 'Face check', state: 'pending' };
    else if (detector === 'loading' || detector === 'idle' || faces === null)
      faceCheck = { label: 'Looking for your face…', state: 'pending' };
    else if (detector === 'unavailable')
      faceCheck = {
        label: 'Face check unavailable',
        state: 'warn',
        help: 'You can continue. Photos will still be taken for your exam admin.',
      };
    else if (faces === 1) faceCheck = { label: 'One face in view', state: 'pass' };
    else if (faces === 0)
      faceCheck = {
        label: "We can't see your face",
        state: 'fail',
        help: 'Sit facing the camera.',
      };
    else
      faceCheck = {
        label: 'More than one person in view',
        state: 'fail',
        help: 'Only you may be visible.',
      };

    const lightCheck: Check =
      camera !== 'on' || lighting === 'unknown'
        ? { label: 'Lighting', state: 'pending' }
        : lighting === 'dark'
          ? {
              label: 'It’s quite dark',
              state: 'warn',
              help: 'Add light in front of you if you can.',
            }
          : { label: 'Lighting looks good', state: 'pass' };

    return [cameraCheck, faceCheck, lightCheck];
  });

  /** The camera and face checks must pass (lighting is only advice). */
  protected readonly ready = computed(() => {
    const [camera, face] = this.checks();
    return camera.state === 'pass' && (face.state === 'pass' || face.state === 'warn');
  });

  constructor() {
    // Show the live stream in the preview whenever it (re)starts.
    effect(() => {
      const video = this.preview()?.nativeElement;
      const stream = this.proctoring.stream();
      if (video && video.srcObject !== stream) video.srcObject = stream;
    });
  }

  ngOnInit(): void {
    void this.proctoring.loadDetector();
    void this.proctoring.startCamera();
  }

  protected retry(): void {
    this.proctoring.stop();
    void this.proctoring.startCamera();
  }

  protected async start(): Promise<void> {
    if (!this.ready()) return;
    this.starting.set(true);
    try {
      // Fullscreen needs this click, so it's requested here rather than on the exam page.
      await this.document.documentElement.requestFullscreen?.();
    } catch {
      /* not supported (e.g. some phones): the exam page will ask again */
    }
    await this.router.navigateByUrl('/exam/take');
  }
}
