import { Injectable } from '@angular/core';
import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { from, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DEFAULT_EXAM_SETTINGS, Exam, NewExam } from '../../shared/models/exam.model';
import { Question } from '../../shared/models/question.model';
import { Candidate, NewCandidate } from '../../shared/models/candidate.model';
import { DEFAULT_RESULT_FIELDS, Result } from '../../shared/models/result.model';

type ExamInput = Omit<Exam, 'id' | 'created_at'>;
type QuestionInput = Omit<Question, 'id'>;
type ResultInput = Omit<Result, 'id' | 'submitted_at'>;

/**
 * Rows read before the Phase 6 migration lack the new columns; fill in the
 * database defaults so the rest of the app can rely on them.
 */
const normalizeExam = (row: Exam): Exam => ({ ...DEFAULT_EXAM_SETTINGS, ...row });
const normalizeResult = (row: Result): Result => ({ ...DEFAULT_RESULT_FIELDS, ...row });

/** Candidate columns the admin app reads. Never the passcode hash. */
const CANDIDATE_COLUMNS = 'id, exam_id, name, username, has_attempted';

/** Shape of every Supabase query response we await. */
interface QueryResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly supabase: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
  );

  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Turns a Supabase query into an Observable that emits the data,
   * or errors with the PostgrestError. Every method below goes through this.
   */
  private run<T>(query: PromiseLike<QueryResponse<unknown>>): Observable<T> {
    return from(this.unwrap<T>(query));
  }

  /** Promise version of run(), for multi-step operations written with async/await. */
  private async unwrap<T>(query: PromiseLike<QueryResponse<unknown>>): Promise<T> {
    const { data, error } = await query;
    if (error) throw error;
    return data as T;
  }

  // Exams
  getExams(): Observable<Exam[]> {
    return this.run<Exam[]>(
      this.supabase.from('exams').select('*').order('created_at', { ascending: false }),
    ).pipe(map((rows) => rows.map(normalizeExam)));
  }

  getExamById(id: string): Observable<Exam> {
    return this.run<Exam>(this.supabase.from('exams').select('*').eq('id', id).single()).pipe(
      map(normalizeExam),
    );
  }

  /** Accepts just the basics; settings not given use the database defaults. */
  createExam(exam: NewExam): Observable<Exam> {
    return this.run<Exam>(this.supabase.from('exams').insert(exam).select().single()).pipe(
      map(normalizeExam),
    );
  }

  updateExam(id: string, changes: Partial<ExamInput>): Observable<Exam> {
    return this.run<Exam>(
      this.supabase.from('exams').update(changes).eq('id', id).select().single(),
    ).pipe(map(normalizeExam));
  }

  deleteExam(id: string): Observable<void> {
    return this.run(this.supabase.from('exams').delete().eq('id', id));
  }

  publishExam(id: string): Observable<Exam> {
    return this.updateExam(id, { is_published: true });
  }

  unpublishExam(id: string): Observable<Exam> {
    return this.updateExam(id, { is_published: false });
  }

  /**
   * Copies an exam and all its questions into a new draft titled "<title> (copy)".
   * Option ids are kept, so MCQ correct answers stay valid in the copy.
   */
  duplicateExam(id: string): Observable<Exam> {
    return from(
      (async () => {
        const source = await this.unwrap<Exam>(
          this.supabase.from('exams').select('*').eq('id', id).single(),
        );
        const questions = await this.unwrap<Question[]>(
          this.supabase.from('questions').select('*').eq('exam_id', id).order('order_index'),
        );

        // Copy everything except identity fields; the copy starts as a draft.
        const { id: sourceId, created_at, ...fields } = source;
        void sourceId;
        void created_at;
        const copy = normalizeExam(
          await this.unwrap<Exam>(
            this.supabase
              .from('exams')
              .insert({ ...fields, title: `${source.title} (copy)`, is_published: false })
              .select()
              .single(),
          ),
        );

        if (questions.length) {
          const rows = questions.map((q) => {
            const { id, ...rest } = q;
            void id; // dropped so the database assigns a new id
            return { ...rest, exam_id: copy.id };
          });
          await this.unwrap(this.supabase.from('questions').insert(rows));
        }
        return copy;
      })(),
    );
  }

  // Questions
  getQuestionsByExamId(examId: string): Observable<Question[]> {
    return this.run(
      this.supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true }),
    );
  }

  createQuestion(question: QuestionInput): Observable<Question> {
    return this.run(this.supabase.from('questions').insert(question).select().single());
  }

  updateQuestion(id: string, changes: Partial<QuestionInput>): Observable<Question> {
    return this.run(this.supabase.from('questions').update(changes).eq('id', id).select().single());
  }

  deleteQuestion(id: string): Observable<void> {
    return this.run(this.supabase.from('questions').delete().eq('id', id));
  }

  /** Saves a new question order: order_index = position in the given list. */
  reorderQuestions(orderedIds: string[]): Observable<void> {
    return from(
      Promise.all(
        orderedIds.map((id, index) =>
          this.unwrap(this.supabase.from('questions').update({ order_index: index }).eq('id', id)),
        ),
      ).then(() => undefined),
    );
  }

  // Candidates
  getCandidatesByExamId(examId: string): Observable<Candidate[]> {
    return this.run(
      this.supabase
        .from('candidates')
        .select(CANDIDATE_COLUMNS)
        .eq('exam_id', examId)
        .order('name'),
    );
  }

  /** Every candidate across all exams (sidebar Candidates page). */
  getAllCandidates(): Observable<Candidate[]> {
    return this.run(this.supabase.from('candidates').select(CANDIDATE_COLUMNS).order('name'));
  }

  createCandidate(candidate: NewCandidate): Observable<Candidate> {
    return this.run(
      this.supabase.from('candidates').insert(candidate).select(CANDIDATE_COLUMNS).single(),
    );
  }

  /** Bulk insert (CSV import) in one request: all rows succeed or none do. */
  createCandidates(candidates: NewCandidate[]): Observable<Candidate[]> {
    return this.run(this.supabase.from('candidates').insert(candidates).select(CANDIDATE_COLUMNS));
  }

  /** `passcode` in changes = reset it (hashed by the database). */
  updateCandidate(id: string, changes: Partial<NewCandidate>): Observable<Candidate> {
    return this.run(
      this.supabase
        .from('candidates')
        .update(changes)
        .eq('id', id)
        .select(CANDIDATE_COLUMNS)
        .single(),
    );
  }

  deleteCandidate(id: string): Observable<void> {
    return this.run(this.supabase.from('candidates').delete().eq('id', id));
  }

  markCandidateAttempted(id: string): Observable<Candidate> {
    return this.run(
      this.supabase
        .from('candidates')
        .update({ has_attempted: true })
        .eq('id', id)
        .select()
        .single(),
    );
  }

  // Results
  submitResult(result: ResultInput): Observable<Result> {
    return this.run(this.supabase.from('results').insert(result).select().single());
  }

  getResultsByExamId(examId: string): Observable<Result[]> {
    return this.run<Result[]>(this.supabase.from('results').select('*').eq('exam_id', examId)).pipe(
      map((rows) => rows.map(normalizeResult)),
    );
  }

  /** Every result across all exams, newest first (sidebar Results page). */
  getAllResults(): Observable<Result[]> {
    return this.run<Result[]>(
      this.supabase.from('results').select('*').order('submitted_at', { ascending: false }),
    ).pipe(map((rows) => rows.map(normalizeResult)));
  }

  /** The candidate's latest attempt, or null when they have not submitted yet. */
  getResultByCandidateId(candidateId: string): Observable<Result | null> {
    return this.run<Result | null>(
      this.supabase
        .from('results')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ).pipe(map((row) => (row ? normalizeResult(row) : null)));
  }

  updateResultGrading(
    resultId: string,
    gradedAnswers: Record<string, boolean>,
    newScore: number,
    isFullyGraded: boolean,
  ): Observable<Result> {
    return this.run<Result>(
      this.supabase
        .from('results')
        .update({ graded_answers: gradedAnswers, score: newScore, is_fully_graded: isFullyGraded })
        .eq('id', resultId)
        .select()
        .single(),
    ).pipe(map(normalizeResult));
  }
}
