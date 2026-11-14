import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectCandidateDictionary,
  selectExamDictionary,
  selectQuestions,
  selectResultDictionary,
  selectResultsError,
  selectResultsSaving,
} from '../../store/exams.selectors';
import { SupabaseService } from '../../../../core/services/supabase';
import { ProctoringEvent } from '../../../../shared/models/proctoring-event.model';
import { ReviewStatus } from '../../../../shared/models/result.model';
import { resultOutcome } from '../../grading';
import { buildTimeline, summarize, TimelineEntry } from '../../proctoring-summary';
import { ResultAnswersComponent } from './result-answers.component';

const TABS = ['answers', 'proctoring'] as const;
type Tab = (typeof TABS)[number];

interface Photo {
  entry: TimelineEntry;
  url: string | null;
}

/** /admin/results/:id: grade answers and review proctoring for one submission. */
@Component({
  selector: 'app-result-review',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    ResultAnswersComponent,
  ],
  templateUrl: './result-review.component.html',
  styleUrl: './result-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultReviewComponent {
  /** Route param :id. */
  readonly id = input.required<string>();
  /** ?tab=proctoring opens that tab directly. */
  readonly tab = input<Tab>();

  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly api = inject(SupabaseService);

  private readonly results = this.store.selectSignal(selectResultDictionary);
  private readonly exams = this.store.selectSignal(selectExamDictionary);
  private readonly candidates = this.store.selectSignal(selectCandidateDictionary);
  private readonly allQuestions = this.store.selectSignal(selectQuestions);
  protected readonly saving = this.store.selectSignal(selectResultsSaving);
  protected readonly storeError = this.store.selectSignal(selectResultsError);

  protected readonly result = computed(() => this.results()[this.id()] ?? null);
  protected readonly exam = computed(() => {
    const r = this.result();
    return r ? (this.exams()[r.exam_id] ?? null) : null;
  });
  protected readonly candidate = computed(() => {
    const r = this.result();
    return r ? (this.candidates()[r.candidate_id] ?? null) : null;
  });
  private readonly questionCount = computed(() => {
    const r = this.result();
    return r ? this.allQuestions().filter((q) => q.exam_id === r.exam_id).length : 0;
  });
  protected readonly percent = computed(() => {
    const r = this.result();
    const total = this.questionCount();
    return r && total ? Math.round(((r.score ?? 0) / total) * 100) : null;
  });
  protected readonly outcome = computed(() =>
    resultOutcome(
      this.percent(),
      this.exam()?.pass_mark ?? null,
      this.result()?.review_status ?? null,
    ),
  );
  protected readonly questionTotal = this.questionCount;

  protected readonly selectedTab = computed(() =>
    Math.max(0, TABS.indexOf(this.tab() ?? 'answers')),
  );

  // --- Proctoring data (loaded for this page only) ---------------------------
  protected readonly events = signal<ProctoringEvent[]>([]);
  protected readonly eventsLoading = signal(false);
  protected readonly eventsError = signal<string | null>(null);
  private readonly urls = signal<Record<string, string>>({});

  protected readonly timeline = computed(() => buildTimeline(this.events()));
  protected readonly summary = computed(() => summarize(this.events()));
  protected readonly flagged = computed(() => {
    const r = this.result();
    return !!r && (r.violation_count > 0 || r.terminated_by_proctoring);
  });

  /** Every event that has (or had) a photo, in time order. */
  protected readonly photos = computed<Photo[]>(() =>
    this.timeline()
      .filter((e) => e.event.snapshot_path || e.snapshotDeleted)
      .map((entry) => ({
        entry,
        url: entry.event.snapshot_path ? (this.urls()[entry.event.snapshot_path] ?? null) : null,
      })),
  );
  /** First and latest available photo, side by side, to spot a different person. */
  protected readonly identityPair = computed(() => {
    const available = this.photos().filter((p) => p.url);
    return available.length >= 2 ? [available[0], available[available.length - 1]] : null;
  });

  /** Index into photos() of the enlarged one, or null. */
  protected readonly viewing = signal<number | null>(null);
  protected readonly viewingPhoto = computed(() => {
    const i = this.viewing();
    return i === null ? null : (this.photos()[i] ?? null);
  });

  // --- Review decision form ---------------------------------------------------
  protected readonly decision = signal<ReviewStatus | null>(null);
  protected readonly note = signal('');
  protected readonly decisionDirty = computed(() => {
    const r = this.result();
    return (
      !!r && (this.decision() !== r.review_status || this.note().trim() !== (r.review_note ?? ''))
    );
  });

  private loadedFor: string | null = null;
  private relatedRequested: string | null = null;

  constructor() {
    // Opened directly (refresh / link): fetch the result.
    effect(() => {
      if (!this.result() && this.loadedFor !== this.id()) {
        this.loadedFor = this.id();
        this.store.dispatch(AdminExamsActions.loadResult({ id: this.id() }));
      }
    });

    // Once the result is known: exam, candidate names, questions, proctoring events.
    effect(() => {
      const r = this.result();
      if (!r || this.relatedRequested === r.id) return;
      this.relatedRequested = r.id;
      if (!this.exams()[r.exam_id]) this.store.dispatch(AdminExamsActions.loadExams());
      this.store.dispatch(AdminExamsActions.loadCandidates({ examId: r.exam_id }));
      this.store.dispatch(AdminExamsActions.loadQuestions({ examId: r.exam_id }));
      this.decision.set(r.review_status);
      this.note.set(r.review_note ?? '');
      void this.loadEvents();
    });

    // Keep the form in step after a save (or a change elsewhere).
    effect(() => {
      const r = this.result();
      if (r && !this.saving()) {
        this.decision.set(r.review_status);
        this.note.set(r.review_note ?? '');
      }
    });
  }

  protected async loadEvents(): Promise<void> {
    const r = this.result();
    if (!r) return;
    this.eventsLoading.set(true);
    this.eventsError.set(null);
    try {
      const events = await this.api.getProctoringEvents(r);
      this.events.set(events);
      const paths = events.map((e) => e.snapshot_path).filter((p): p is string => !!p);
      this.urls.set(await this.api.signSnapshotUrls(paths));
    } catch {
      this.eventsError.set("Couldn't load the proctoring record. Try again.");
    } finally {
      this.eventsLoading.set(false);
    }
  }

  protected onTabChange(index: number): void {
    this.router.navigate([], {
      queryParams: { tab: index === 0 ? null : TABS[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected saveDecision(): void {
    const r = this.result();
    if (!r) return;
    this.store.dispatch(
      AdminExamsActions.saveReview({
        id: r.id,
        status: this.decision(),
        note: this.note().trim() || null,
      }),
    );
  }

  protected clearDecision(): void {
    this.decision.set(null);
    this.note.set('');
  }

  // --- Photo viewer -----------------------------------------------------------
  protected openPhoto(entry: TimelineEntry): void {
    const i = this.photos().findIndex((p) => p.entry.event.id === entry.event.id);
    if (i >= 0) this.viewing.set(i);
  }

  protected step(delta: number): void {
    const i = this.viewing();
    if (i === null) return;
    const next = i + delta;
    if (next >= 0 && next < this.photos().length) this.viewing.set(next);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (this.viewing() === null) return;
    if (e.key === 'Escape') this.viewing.set(null);
    else if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowLeft') this.step(-1);
  }
}
