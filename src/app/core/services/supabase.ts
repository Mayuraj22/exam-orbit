import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Exam } from '../../shared/models/exam.model';
import { Question } from '../../shared/models/question.model';
import { Candidate } from '../../shared/models/candidate.model';
import { Result } from '../../shared/models/result.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // Exams
  getExams(): Observable<Exam[]> {
    return from(this.supabase.from('exams').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) throw error;
      return data as Exam[];
    }));
  }

  getExamById(id: string): Observable<Exam> {
    return from(this.supabase.from('exams').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) throw error;
      return data as Exam;
    }));
  }

  createExam(exam: Omit<Exam, 'id' | 'created_at'>): Observable<Exam> {
    return from(this.supabase.from('exams').insert(exam).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Exam;
    }));
  }

  updateExam(id: string, changes: Partial<Omit<Exam, 'id' | 'created_at'>>): Observable<Exam> {
    return from(this.supabase.from('exams').update(changes).eq('id', id).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Exam;
    }));
  }

  deleteExam(id: string): Observable<void> {
    return from(this.supabase.from('exams').delete().eq('id', id).then(({ error }) => {
      if (error) throw error;
    }));
  }

  publishExam(id: string): Observable<Exam> {
    return from(this.supabase.from('exams').update({ is_published: true }).eq('id', id).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Exam;
    }));
  }

  // Questions
  getQuestionsByExamId(examId: string): Observable<Question[]> {
    return from(this.supabase.from('questions').select('*').eq('exam_id', examId).order('order_index', { ascending: true }).then(({ data, error }) => {
      if (error) throw error;
      return data as Question[];
    }));
  }

  createQuestion(question: Omit<Question, 'id'>): Observable<Question> {
    return from(this.supabase.from('questions').insert(question).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Question;
    }));
  }

  updateQuestion(id: string, changes: Partial<Omit<Question, 'id'>>): Observable<Question> {
    return from(this.supabase.from('questions').update(changes).eq('id', id).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Question;
    }));
  }

  deleteQuestion(id: string): Observable<void> {
    return from(this.supabase.from('questions').delete().eq('id', id).then(({ error }) => {
      if (error) throw error;
    }));
  }

  // Candidates
  getCandidatesByExamId(examId: string): Observable<Candidate[]> {
    return from(this.supabase.from('candidates').select('*').eq('exam_id', examId).then(({ data, error }) => {
      if (error) throw error;
      return data as Candidate[];
    }));
  }

  createCandidate(candidate: Omit<Candidate, 'id'>): Observable<Candidate> {
    return from(this.supabase.from('candidates').insert(candidate).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Candidate;
    }));
  }

  verifyCandidateLogin(username: string, passcode: string): Observable<Candidate> {
    return from(this.supabase.from('candidates').select('*').eq('username', username).eq('passcode', passcode).single().then(({ data, error }) => {
      if (error) throw error;
      return data as Candidate;
    }));
  }

  markCandidateAttempted(id: string): Observable<Candidate> {
    return from(this.supabase.from('candidates').update({ has_attempted: true }).eq('id', id).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Candidate;
    }));
  }

  // Results
  submitResult(result: Omit<Result, 'id' | 'submitted_at'>): Observable<Result> {
    return from(this.supabase.from('results').insert(result).select().single().then(({ data, error }) => {
      if (error) throw error;
      return data as Result;
    }));
  }

  getResultsByExamId(examId: string): Observable<Result[]> {
    return from(this.supabase.from('results').select('*').eq('exam_id', examId).then(({ data, error }) => {
      if (error) throw error;
      return data as Result[];
    }));
  }

  getResultByCandidateId(candidateId: string): Observable<Result> {
    return from(this.supabase.from('results').select('*').eq('candidate_id', candidateId).single().then(({ data, error }) => {
      if (error) throw error;
      return data as Result;
    }));
  }
}