import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Exam } from '../../../shared/models/exam.model';
import { Question } from '../../../shared/models/question.model';

export const AdminExamsActions = createActionGroup({
  source: 'Admin Exams',
  events: {
    'Load Exams': emptyProps(),
    'Load Exams Success': props<{ exams: Exam[] }>(),
    'Load Exams Failure': props<{ error: string }>(),

    'Create Exam': props<{ exam: Omit<Exam, 'id' | 'created_at'> }>(),
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
  },
});
