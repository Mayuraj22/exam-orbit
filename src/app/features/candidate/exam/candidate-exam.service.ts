import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase';
import { CandidateSessionService } from '../../auth/candidate-session.service';
import {
  LogEventResult,
  SaveAnswerStatus,
  StartExamResult,
  ViolationType,
} from './candidate-exam.models';

const SNAPSHOT_BUCKET = 'proctoring-snapshots';

/**
 * Candidate exam API. Every call goes through a database function that checks
 * the session token; snapshots go to a private bucket the candidate can only add to.
 */
@Injectable({ providedIn: 'root' })
export class CandidateExamService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly sessions = inject(CandidateSessionService);

  private get token(): string {
    const token = this.sessions.token();
    if (!token) throw new Error('No exam session');
    return token;
  }

  async start(): Promise<StartExamResult> {
    const { data, error } = await this.supabase.rpc('candidate_start_exam', {
      p_token: this.token,
    });
    if (error) throw error;
    return data as StartExamResult;
  }

  async saveAnswer(questionId: string, answer: string | null): Promise<SaveAnswerStatus> {
    const { data, error } = await this.supabase.rpc('candidate_save_answer', {
      p_token: this.token,
      p_question_id: questionId,
      p_answer: answer,
    });
    if (error) throw error;
    return (data as { status: SaveAnswerStatus }).status;
  }

  async logEvent(
    type: ViolationType | 'snapshot',
    snapshotPath: string | null,
    details: Record<string, unknown> = {},
  ): Promise<LogEventResult> {
    const { data, error } = await this.supabase.rpc('candidate_log_event', {
      p_token: this.token,
      p_event_type: type,
      p_snapshot_path: snapshotPath,
      p_details: details,
    });
    if (error) throw error;
    return data as LogEventResult;
  }

  async submit(): Promise<'submitted' | 'not_in_progress'> {
    const { data, error } = await this.supabase.rpc('candidate_submit', { p_token: this.token });
    if (error) throw error;
    return (data as { status: 'submitted' | 'not_in_progress' }).status;
  }

  /** Uploads a JPEG into this session's folder; returns its path, or null if it failed. */
  async uploadSnapshot(image: Blob, attemptNumber: number): Promise<string | null> {
    const path = `${this.token}/${attemptNumber}/${Date.now()}.jpg`;
    const { error } = await this.supabase.storage
      .from(SNAPSHOT_BUCKET)
      .upload(path, image, { contentType: 'image/jpeg', upsert: false });
    return error ? null : path;
  }
}
