import { Injectable } from '@angular/core';
import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Exam } from '../../shared/models/exam.model';
import { Question } from '../../shared/models/question.model';
import { Candidate } from '../../shared/models/candidate.model';
import { Result } from '../../shared/models/result.model';

type ExamInput = Omit<Exam, 'id' | 'created_at'>;
type QuestionInput = Omit<Question, 'id'>;
type CandidateInput = Omit<Candidate, 'id'>;
type ResultInput = Omit<Result, 'id' | 'submitted_at'>;

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
    return this.run(
      this.supabase.from('exams').select('*').order('created_at', { ascending: false }),
    );
  }

  getExamById(id: string): Observable<Exam> {
    return this.run(this.supabase.from('exams').select('*').eq('id', id).single());
  }

  createExam(exam: ExamInput): Observable<Exam> {
    return this.run(this.supabase.from('exams').insert(exam).select().single());
  }

  updateExam(id: string, changes: Partial<ExamInput>): Observable<Exam> {
    return this.run(this.supabase.from('exams').update(changes).eq('id', id).select().single());
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

        const copy = await this.unwrap<Exam>(
          this.supabase
            .from('exams')
            .insert({
              title: `${source.title} (copy)`,
              description: source.description,
              duration_minutes: source.duration_minutes,
              is_published: false,
            })
            .select()
            .single(),
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
      this.supabase.from('candidates').select('*').eq('exam_id', examId).order('name'),
    );
  }

  /** Every candidate across all exams (sidebar Candidates page). */
  getAllCandidates(): Observable<Candidate[]> {
    return this.run(this.supabase.from('candidates').select('*').order('name'));
  }

  createCandidate(candidate: CandidateInput): Observable<Candidate> {
    return this.run(this.supabase.from('candidates').insert(candidate).select().single());
  }

  /** Bulk insert (CSV import) in one request: all rows succeed or none do. */
  createCandidates(candidates: CandidateInput[]): Observable<Candidate[]> {
    return this.run(this.supabase.from('candidates').insert(candidates).select());
  }

  updateCandidate(id: string, changes: Partial<CandidateInput>): Observable<Candidate> {
    return this.run(
      this.supabase.from('candidates').update(changes).eq('id', id).select().single(),
    );
  }

  deleteCandidate(id: string): Observable<void> {
    return this.run(this.supabase.from('candidates').delete().eq('id', id));
  }

  // TODO(security phase): move to a server-side function with hashed passcodes.
  verifyCandidateLogin(username: string, passcode: string): Observable<Candidate> {
    return this.run(
      this.supabase
        .from('candidates')
        .select('*')
        .eq('username', username)
        .eq('passcode', passcode)
        .single(),
    );
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
    return this.run(this.supabase.from('results').select('*').eq('exam_id', examId));
  }

  /** Every result across all exams, newest first (sidebar Results page). */
  getAllResults(): Observable<Result[]> {
    return this.run(
      this.supabase.from('results').select('*').order('submitted_at', { ascending: false }),
    );
  }

  /** Emits null when the candidate has not submitted yet. */
  getResultByCandidateId(candidateId: string): Observable<Result | null> {
    return this.run(
      this.supabase.from('results').select('*').eq('candidate_id', candidateId).maybeSingle(),
    );
  }

  updateResultGrading(
    resultId: string,
    gradedAnswers: Record<string, boolean>,
    newScore: number,
    isFullyGraded: boolean,
  ): Observable<Result> {
    return this.run(
      this.supabase
        .from('results')
        .update({ graded_answers: gradedAnswers, score: newScore, is_fully_graded: isFullyGraded })
        .eq('id', resultId)
        .select()
        .single(),
    );
  }
}
