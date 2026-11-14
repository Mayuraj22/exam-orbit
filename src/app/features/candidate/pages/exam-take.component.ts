import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { filter } from 'rxjs';
import { CandidateExamService } from '../exam/candidate-exam.service';
import { ProctoringService } from '../exam/proctoring.service';
import {
  ExamProctoringSettings,
  ExamQuestion,
  ViolationType,
  VIOLATION_MESSAGES,
} from '../exam/candidate-exam.models';
import { CandidateSessionService } from '../../auth/candidate-session.service';
import { CandidateAuthActions } from '../../auth/store/auth.actions';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import {
  ProctoringWarningData,
  ProctoringWarningDialogComponent,
} from './proctoring-warning-dialog.component';

type SaveState = 'saving' | 'saved' | 'error';
export type FinishReason = 'submitted' | 'terminated' | 'time_up';

const INPUT_SAVE_DELAY_MS = 800;

/** /exam/take: the exam itself. */
@Component({
  selector: 'app-exam-take',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  templateUrl: './exam-take.component.html',
  styleUrl: './exam-take.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamTakeComponent implements OnInit {
  private readonly api = inject(CandidateExamService);
  protected readonly proctoring = inject(ProctoringService);
  private readonly sessions = inject(CandidateSessionService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selfView = viewChild<ElementRef<HTMLVideoElement>>('selfView');

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly questions = signal<ExamQuestion[]>([]);
  protected readonly settings = signal<ExamProctoringSettings | null>(null);
  protected readonly answers = signal<Record<string, string>>({});
  protected readonly saveStates = signal<Record<string, SaveState>>({});
  protected readonly index = signal(0);
  protected readonly submitting = signal(false);
  protected readonly isFullscreen = signal(true);
  protected readonly violations = signal(0);

  /** Deadline in local-clock milliseconds (corrected for a wrong device clock). */
  private deadline = 0;
  private readonly now = signal(Date.now());
  private finished = false;
  private readonly pendingInputs = new Map<string, ReturnType<typeof setTimeout>>();

  protected readonly current = computed(() => this.questions()[this.index()] ?? null);
  protected readonly answeredCount = computed(
    () => this.questions().filter((q) => !!this.answers()[q.id]?.trim()).length,
  );
  protected readonly remainingMs = computed(() => Math.max(0, this.deadline - this.now()));
  protected readonly timeLabel = computed(() => {
    const total = Math.ceil(this.remainingMs() / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0');
    return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
  });
  protected readonly timeLow = computed(() => this.remainingMs() <= 5 * 60 * 1000);
  protected readonly proctored = computed(() => !!this.settings()?.camera_required);
  protected readonly anySaving = computed(() =>
    Object.values(this.saveStates()).some((s) => s === 'saving'),
  );
  protected readonly anyError = computed(() =>
    Object.values(this.saveStates()).some((s) => s === 'error'),
  );

  constructor() {
    effect(() => {
      const video = this.selfView()?.nativeElement;
      const stream = this.proctoring.stream();
      if (video && video.srcObject !== stream) video.srcObject = stream;
    });

    // Clock tick + auto-submit when time is up.
    const timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.deadline && this.remainingMs() === 0 && !this.finished && !this.loading()) {
        void this.submit(true);
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    const onFullscreen = () => this.isFullscreen.set(!!this.document.fullscreenElement);
    this.document.addEventListener('fullscreenchange', onFullscreen);
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('fullscreenchange', onFullscreen),
    );

    this.proctoring.warnings$.pipe(takeUntilDestroyed()).subscribe(({ type, result }) => {
      this.violations.set(result.violation_count ?? this.violations());
      if (result.terminated) {
        void this.finish('terminated');
      } else if (this.proctored() && result.warning_number) {
        this.showWarning(type, result.warning_number, result.max_warnings ?? 0);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const result = await this.api.start();
      switch (result.status) {
        case 'ok':
          break;
        case 'time_up':
          return void this.finish('time_up');
        case 'already_attempted':
          return void this.finish('submitted');
        default:
          this.sessions.forget();
          this.store.dispatch(CandidateAuthActions.examFinished());
          return void this.router.navigateByUrl('/exam/login');
      }

      const { attempt, settings, questions } = result as Required<typeof result>;
      const clockOffset = Date.parse(attempt.server_now) - Date.now();
      this.deadline = Date.parse(attempt.deadline_at) - clockOffset;
      this.now.set(Date.now());
      this.questions.set(questions);
      this.answers.set(attempt.answers ?? {});
      this.settings.set(settings);
      this.violations.set(attempt.violation_count);
      this.isFullscreen.set(!!this.document.fullscreenElement);

      if (settings.camera_required) {
        // After a refresh the camera may be off: turn it back on (permission is remembered).
        void this.proctoring.loadDetector();
        await this.proctoring.startCamera();
      }
      this.proctoring.startMonitoring(attempt.attempt_number, settings.snapshot_interval_seconds);
    } catch {
      this.loadError.set("Couldn't load your exam. Check your connection and try again.");
    } finally {
      this.loading.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Answers
  // ---------------------------------------------------------------------------

  protected chooseOption(question: ExamQuestion, optionId: string): void {
    this.answers.update((a) => ({ ...a, [question.id]: optionId }));
    void this.save(question.id);
  }

  protected typeAnswer(question: ExamQuestion, value: string): void {
    this.answers.update((a) => ({ ...a, [question.id]: value }));
    clearTimeout(this.pendingInputs.get(question.id));
    this.pendingInputs.set(
      question.id,
      setTimeout(() => void this.save(question.id), INPUT_SAVE_DELAY_MS),
    );
  }

  /** Save right away when leaving a typed answer. */
  protected flushInput(question: ExamQuestion): void {
    if (this.pendingInputs.has(question.id)) {
      clearTimeout(this.pendingInputs.get(question.id));
      void this.save(question.id);
    }
  }

  private async save(questionId: string): Promise<void> {
    this.pendingInputs.delete(questionId);
    this.setSaveState(questionId, 'saving');
    try {
      const status = await this.api.saveAnswer(questionId, this.answers()[questionId] ?? null);
      if (status === 'ok') this.setSaveState(questionId, 'saved');
      else if (status === 'time_up') void this.finish('time_up');
      else if (status === 'not_in_progress') void this.finish('submitted');
      else this.setSaveState(questionId, 'error');
    } catch {
      this.setSaveState(questionId, 'error');
    }
  }

  private setSaveState(questionId: string, state: SaveState): void {
    this.saveStates.update((s) => ({ ...s, [questionId]: state }));
  }

  /** Saves anything typed but not yet sent, and retries failed saves. */
  private async flushAll(): Promise<void> {
    const ids = new Set([
      ...this.pendingInputs.keys(),
      ...Object.entries(this.saveStates())
        .filter(([, s]) => s === 'error')
        .map(([id]) => id),
    ]);
    this.pendingInputs.forEach((t) => clearTimeout(t));
    this.pendingInputs.clear();
    await Promise.all([...ids].map((id) => this.save(id)));
  }

  // ---------------------------------------------------------------------------
  // Navigation, fullscreen, warnings
  // ---------------------------------------------------------------------------

  protected go(i: number): void {
    const q = this.current();
    if (q) this.flushInput(q);
    this.index.set(Math.min(Math.max(i, 0), this.questions().length - 1));
  }

  /** The saved answer for a question, or undefined when not answered yet. */
  protected answerFor(q: ExamQuestion): string | undefined {
    return (this.answers() as Partial<Record<string, string>>)[q.id];
  }

  protected isAnswered(q: ExamQuestion): boolean {
    return !!this.answers()[q.id]?.trim();
  }

  protected async enterFullscreen(): Promise<void> {
    try {
      await this.document.documentElement.requestFullscreen?.();
    } catch {
      /* unsupported */
    }
  }

  private showWarning(type: ViolationType, warningNumber: number, maxWarnings: number): void {
    this.dialog.closeAll();
    this.dialog
      .open<ProctoringWarningDialogComponent, ProctoringWarningData>(
        ProctoringWarningDialogComponent,
        {
          data: { message: VIOLATION_MESSAGES[type], warningNumber, maxWarnings },
          disableClose: true,
          width: '440px',
          maxWidth: '94vw',
        },
      )
      .afterClosed()
      .subscribe(() => {
        // The click on "I understand" lets us go back to fullscreen.
        if (this.proctored() && !this.document.fullscreenElement) void this.enterFullscreen();
      });
  }

  // ---------------------------------------------------------------------------
  // Submit / finish
  // ---------------------------------------------------------------------------

  protected confirmSubmit(): void {
    const unanswered = this.questions().length - this.answeredCount();
    this.confirm
      .ask({
        title: 'Submit your exam?',
        message:
          unanswered > 0
            ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You can't change your answers after submitting.`
            : "You've answered every question. You can't change your answers after submitting.",
        confirmText: 'Submit exam',
      })
      .pipe(filter(Boolean))
      .subscribe(() => void this.submit(false));
  }

  private async submit(timeUp: boolean): Promise<void> {
    if (this.submitting() || this.finished) return;
    this.submitting.set(true);
    await this.flushAll();
    try {
      await this.api.submit();
      void this.finish(timeUp ? 'time_up' : 'submitted');
    } catch {
      this.submitting.set(false);
      this.loadError.set(null);
      // Keep the exam open; the timer will try again, or the candidate can retry.
      this.confirm
        .ask({
          title: "Couldn't submit",
          message: 'Your answers are saved. Check your connection, then try again.',
          confirmText: 'Try again',
        })
        .pipe(filter(Boolean))
        .subscribe(() => void this.submit(timeUp));
    }
  }

  private async finish(reason: FinishReason): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    this.dialog.closeAll();
    this.proctoring.stop();
    if (this.document.fullscreenElement)
      await this.document.exitFullscreen().catch(() => undefined);
    this.sessions.forget();
    this.store.dispatch(CandidateAuthActions.examFinished());
    await this.router.navigateByUrl(`/exam/done?reason=${reason}`);
  }

  /** Ask before closing or reloading the tab mid-exam. */
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (!this.finished && !this.loading() && !this.loadError()) event.preventDefault();
  }
}
