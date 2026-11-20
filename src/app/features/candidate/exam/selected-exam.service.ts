import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AssignedExam } from '../../../shared/models/candidate-session.model';

const KEY = 'examorbit-selected-exam';

/**
 * The exam the candidate chose on "My exams". Kept in sessionStorage so the
 * welcome, camera-check and exam pages survive a refresh.
 */
@Injectable({ providedIn: 'root' })
export class SelectedExamService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly exam = signal<AssignedExam | null>(this.load());

  select(exam: AssignedExam): void {
    this.exam.set(exam);
    this.save(exam);
  }

  clear(): void {
    this.exam.set(null);
    this.save(null);
  }

  private load(): AssignedExam | null {
    if (!this.isBrowser) return null;
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AssignedExam) : null;
    } catch {
      return null;
    }
  }

  private save(exam: AssignedExam | null): void {
    if (!this.isBrowser) return;
    try {
      if (exam) sessionStorage.setItem(KEY, JSON.stringify(exam));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage blocked: the choice just won't survive a refresh */
    }
  }
}
