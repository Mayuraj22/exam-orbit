import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CandidateAuthActions } from '../../auth/store/auth.actions';
import { selectCandidateSession } from '../../auth/store/auth.selectors';
import { CandidateExamService } from '../exam/candidate-exam.service';
import { SelectedExamService } from '../exam/selected-exam.service';
import { AssignedExam } from '../../../shared/models/candidate-session.model';

/** /exam/home: the candidate's assigned exams; pick one to start or resume. */
@Component({
  selector: 'app-candidate-home',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <article class="home">
      <p class="greeting">Hi {{ firstName() }}</p>
      <h1>Your exams</h1>

      @if (loading()) {
        <div class="center" aria-busy="true"><mat-spinner diameter="32" /></div>
      } @else if (error(); as message) {
        <div class="error-banner" role="alert">
          <mat-icon>error_outline</mat-icon>
          <span>{{ message }}</span>
          <span class="spacer"></span>
          <button mat-button type="button" (click)="load()">Try again</button>
        </div>
      } @else {
        <ul class="exams">
          @for (exam of exams(); track exam.id) {
            <li [class.muted]="exam.state === 'completed' || exam.state === 'not_open'">
              <div class="info">
                <span class="title">{{ exam.title }}</span>
                <span class="meta">
                  {{ exam.duration_minutes }} min · {{ exam.question_count }} question{{
                    exam.question_count === 1 ? '' : 's'
                  }}
                  @if (exam.camera_required) {
                    · <mat-icon inline aria-hidden="true">videocam</mat-icon> webcam
                  }
                </span>
              </div>
              @switch (exam.state) {
                @case ('available') {
                  <button mat-flat-button type="button" (click)="open(exam)">Start</button>
                }
                @case ('in_progress') {
                  <button mat-flat-button type="button" (click)="open(exam)">Resume</button>
                }
                @case ('completed') {
                  <span class="state done"
                    ><mat-icon aria-hidden="true">task_alt</mat-icon> Done</span
                  >
                }
                @default {
                  <span class="state"
                    ><mat-icon aria-hidden="true">schedule</mat-icon> Not open yet</span
                  >
                }
              }
            </li>
          } @empty {
            <li class="empty">
              No exams are assigned to you yet. Your exam admin will let you know when one is ready.
            </li>
          }
        </ul>
      }

      <div class="actions">
        <button mat-button type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
        <button mat-button type="button" (click)="signOut()">Sign out</button>
      </div>
    </article>
  `,
  styles: `
    .home {
      width: 100%;
      max-width: 640px;
      padding: 28px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      background: var(--mat-sys-surface);
    }
    .greeting {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    h1 {
      margin: 4px 0 16px;
      font: var(--mat-sys-headline-small);
    }
    .center {
      display: flex;
      justify-content: center;
      padding: 32px;
    }
    .exams {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .exams li {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 4px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .exams li.muted .title {
      color: var(--mat-sys-on-surface-variant);
    }
    .info {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .title {
      font: var(--mat-sys-title-medium);
    }
    .meta {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .meta mat-icon {
      vertical-align: -2px;
    }
    .state {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
    }
    .state.done {
      color: var(--app-success-fg);
    }
    .empty {
      justify-content: center;
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }
    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
    }
    .spacer {
      flex: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidateHomeComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly api = inject(CandidateExamService);
  private readonly selected = inject(SelectedExamService);

  private readonly session = this.store.selectSignal(selectCandidateSession);
  protected readonly firstName = computed(
    () => this.session()?.candidate.name.split(' ')[0] ?? 'there',
  );

  protected readonly exams = signal<AssignedExam[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.api.myExams();
      if (result.status === 'expired') {
        this.store.dispatch(CandidateAuthActions.logout());
        return;
      }
      this.exams.set(result.exams ?? []);
    } catch {
      this.error.set("Couldn't load your exams. Check your connection and try again.");
    } finally {
      this.loading.set(false);
    }
  }

  protected open(exam: AssignedExam): void {
    this.selected.select(exam);
    // Resuming goes straight back into the exam (camera check if needed).
    if (exam.state === 'in_progress') {
      void this.router.navigateByUrl(exam.camera_required ? '/exam/check' : '/exam/take');
    } else {
      void this.router.navigateByUrl('/exam/welcome');
    }
  }

  protected signOut(): void {
    this.selected.clear();
    this.store.dispatch(CandidateAuthActions.logout());
  }
}
