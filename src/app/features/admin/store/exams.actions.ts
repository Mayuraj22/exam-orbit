import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Exam, NewExam } from '../../../shared/models/exam.model';
import { Question } from '../../../shared/models/question.model';
import { Result, ReviewStatus } from '../../../shared/models/result.model';
import { Candidate, NewCandidate } from '../../../shared/models/candidate.model';

export const AdminExamsActions = createActionGroup({
  source: 'Admin Exams',
  events: {
    'Load Exams': emptyProps(),
    'Load Exams Success': props<{ exams: Exam[] }>(),
    'Load Exams Failure': props<{ error: string }>(),

    'Create Exam': props<{ exam: NewExam }>(),
    'Create Exam Success': props<{ exam: Exam }>(),
    'Create Exam Failure': props<{ error: string }>(),

    'Update Exam': props<{ id: string; changes: Partial<Omit<Exam, 'id' | 'created_at'>> }>(),
    'Update Exam Success': props<{ exam: Exam }>(),
    'Update Exam Failure': props<{ error: string }>(),

    'Delete Exam': props<{ id: string }>(),
    'Delete Exam Success': props<{ id: string }>(),
    'Delete Exam Failure': props<{ error: string }>(),

    'Publish Exam': props<{ id: string }>(),
    'Publish Exam Success': props<{ exam: Exam }>(),
    'Publish Exam Failure': props<{ error: string }>(),

    'Unpublish Exam': props<{ id: string }>(),
    'Unpublish Exam Success': props<{ exam: Exam }>(),
    'Unpublish Exam Failure': props<{ error: string }>(),

    /** Copies the exam and all its questions as a new draft. */
    'Duplicate Exam': props<{ id: string }>(),
    'Duplicate Exam Success': props<{ exam: Exam }>(),
    'Duplicate Exam Failure': props<{ error: string }>(),

    'Select Exam': props<{ examId: string | null }>(),

    'Load Questions': props<{ examId: string }>(),
    'Load Questions Success': props<{ questions: Question[] }>(),
    'Load Questions Failure': props<{ error: string }>(),

    'Create Question': props<{ question: Omit<Question, 'id'> }>(),
    'Create Question Success': props<{ question: Question }>(),
    'Create Question Failure': props<{ error: string }>(),

    'Update Question': props<{ id: string; changes: Partial<Omit<Question, 'id'>> }>(),
    'Update Question Success': props<{ question: Question }>(),
    'Update Question Failure': props<{ error: string }>(),

    'Delete Question': props<{ id: string }>(),
    'Delete Question Success': props<{ id: string }>(),
    'Delete Question Failure': props<{ error: string }>(),

    /** Applied to the store immediately (optimistic), then saved. */
    'Reorder Questions': props<{ examId: string; orderedIds: string[] }>(),
    'Reorder Questions Success': emptyProps(),
    'Reorder Questions Failure': props<{ examId: string; error: string }>(),

    /** examId omitted = all candidates across exams. */
    'Load Candidates': props<{ examId?: string }>(),
    'Load Candidates Success': props<{ candidates: Candidate[] }>(),
    'Load Candidates Failure': props<{ error: string }>(),

    /** One or many (CSV import); saved in a single request. */
    'Create Candidates': props<{ candidates: NewCandidate[] }>(),
    'Create Candidates Success': props<{ candidates: Candidate[] }>(),
    'Create Candidates Failure': props<{ error: string }>(),

    'Delete Candidate': props<{ id: string }>(),
    'Delete Candidate Success': props<{ id: string }>(),
    'Delete Candidate Failure': props<{ error: string }>(),

    /** Lets a candidate take the exam again (has_attempted → false). */
    'Reset Candidate Attempt': props<{ id: string }>(),
    'Reset Candidate Attempt Success': props<{ candidate: Candidate }>(),
    'Reset Candidate Attempt Failure': props<{ error: string }>(),

    /** Sets a new passcode (generated in the app, shown to the admin once). */
    'Reset Candidate Passcode': props<{ id: string; passcode: string }>(),
    'Reset Candidate Passcode Success': props<{ candidate: Candidate }>(),
    'Reset Candidate Passcode Failure': props<{ error: string }>(),

    'Load All Results': emptyProps(),

    /** One result by id (review page opened directly). */
    'Load Result': props<{ id: string }>(),
    'Load Result Success': props<{ result: Result }>(),
    'Load Result Failure': props<{ error: string }>(),

    'Save Review': props<{ id: string; status: ReviewStatus | null; note: string | null }>(),
    'Save Review Success': props<{ result: Result }>(),
    'Save Review Failure': props<{ error: string }>(),

    'Load Results For Exam': props<{ examId: string }>(),
    'Load Results For Exam Success': props<{ results: Result[] }>(),
    'Load Results For Exam Failure': props<{ error: string }>(),

    'Submit Grading': props<{
      resultId: string;
      gradedAnswers: Record<string, boolean>;
      newScore: number;
      isFullyGraded: boolean;
    }>(),
    'Submit Grading Success': props<{ result: Result }>(),
    'Submit Grading Failure': props<{ error: string }>(),
  },
});
