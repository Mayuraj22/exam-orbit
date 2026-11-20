import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { selectQuestions } from '../../store/exams.selectors';
import { SupabaseService } from '../../../../core/services/supabase';
import { gradeResult } from '../../grading';
import { buildTimeline, summarize, ProctoringSummary } from '../../proctoring-summary';
import { BADGE_LABELS, ResultRow } from './result-row';

type DotState = 'right' | 'wrong' | 'pending';

interface Photo {
  url: string;
  label: string;
  elapsed: string;
  violation: boolean;
}

/** How many photos fit in the preview (the rest are behind "View all"). */
const MAX_PHOTOS = 5;

/**
 * The right-hand panel of the Results split view: who, the score with one dot
 * per question, four key facts, and a proctoring preview.
 */
@Component({
  selector: 'app-result-summary-panel',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './result-summary-panel.component.html',
  styleUrl: './result-summary-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultSummaryPanelComponent {
  readonly row = input.required<ResultRow>();

  private readonly api = inject(SupabaseService);
  private readonly questions = inject(Store).selectSignal(selectQuestions);
  protected readonly badgeLabels = BADGE_LABELS;

  /** One dot per question, in exam order: right / wrong / still to grade. */
  protected readonly dots = computed(() => {
    const r = this.row();
    const questions = this.questions()
      .filter((q) => q.exam_id === r.exam_id)
      .sort((a, b) => a.order_index - b.order_index);
    return gradeResult(r, questions).map((a, i) => {
      const state: DotState = a.correct === null ? 'pending' : a.correct ? 'right' : 'wrong';
      const label = state === 'right' ? 'correct' : state === 'wrong' ? 'wrong' : 'to grade';
      return { n: i + 1, state, tip: `Question ${i + 1}: ${label}` };
    });
  });

  protected readonly decisionLabel = computed(() => {
    const r = this.row();
    switch (r.review_status) {
      case 'cleared':
        return 'Cleared';
      case 'suspicious':
        return 'Suspicious';
      case 'disqualified':
        return 'Disqualified';
      default:
        return r.needsReview ? 'Not reviewed' : 'Not needed';
    }
  });

  // --- Proctoring preview (loaded when the selection changes) ----------------
  protected readonly loading = signal(false);
  protected readonly summary = signal<ProctoringSummary | null>(null);
  protected readonly photos = signal<Photo[]>([]);
  protected readonly morePhotos = signal(0);
  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const r = this.row();
      if (this.loadedFor === r.id) return;
      this.loadedFor = r.id;
      void this.loadProctoring(r);
    });
  }

  private async loadProctoring(r: ResultRow): Promise<void> {
    this.loading.set(true);
    this.summary.set(null);
    this.photos.set([]);
    this.morePhotos.set(0);
    try {
      const events = await this.api.getProctoringEvents(r);
      // Warnings first, then the rest in time order.
      const withPhotos = buildTimeline(events)
        .filter((t) => t.event.snapshot_path)
        .sort((a, b) => Number(b.violation) - Number(a.violation));
      const shown = withPhotos.slice(0, MAX_PHOTOS);
      const urls = await this.api.signSnapshotUrls(shown.map((t) => t.event.snapshot_path!));
      if (this.loadedFor !== r.id) return; // selection moved on meanwhile

      this.summary.set(summarize(events));
      this.photos.set(
        shown
          .filter((t) => urls[t.event.snapshot_path!])
          .map((t) => ({
            url: urls[t.event.snapshot_path!],
            label: t.event.warning_number
              ? `Warning ${t.event.warning_number}`
              : t.event.event_type === 'exam_started'
                ? 'Start'
                : 'Photo',
            elapsed: t.elapsed,
            violation: t.violation,
          })),
      );
      this.morePhotos.set(Math.max(0, withPhotos.length - shown.length));
    } catch {
      this.summary.set(null);
    } finally {
      if (this.loadedFor === r.id) this.loading.set(false);
    }
  }
}
