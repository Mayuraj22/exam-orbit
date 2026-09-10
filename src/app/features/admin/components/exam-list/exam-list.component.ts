import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectExams,
  selectExamsLoading,
  selectExamsError,
  selectSelectedExam,
} from '../../store/exams.selectors';
import { Exam } from '../../../../shared/models/exam.model';
import { QuestionFormComponent } from '../question-form/question-form.component';

@Component({
  selector: 'app-exam-list',
  standalone: true,
  imports: [CommonModule, FormsModule, QuestionFormComponent],
  templateUrl: './exam-list.component.html',
  styleUrls: ['./exam-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamListComponent implements OnInit {
  private store = inject(Store);

  exams$ = this.store.select(selectExams);
  loading$ = this.store.select(selectExamsLoading);
  error$ = this.store.select(selectExamsError);
  selectedExam$ = this.store.select(selectSelectedExam);

  showNewExamForm = false;
  newExamForm = {
    title: '',
    description: '',
    duration_minutes: 60,
  };

  ngOnInit(): void {
    this.store.dispatch(AdminExamsActions.loadExams());
  }

  selectExam(examId: string): void {
    this.store.dispatch(AdminExamsActions.selectExam({ examId }));
  }

  publishExam(examId: string): void {
    this.store.dispatch(AdminExamsActions.publishExam({ id: examId }));
  }

  deleteExam(examId: string): void {
    if (confirm('Are you sure you want to delete this exam?')) {
      this.store.dispatch(AdminExamsActions.deleteExam({ id: examId }));
    }
  }

  createExam(): void {
    if (this.newExamForm.title.trim()) {
      this.store.dispatch(
        AdminExamsActions.createExam({
          exam: {
            title: this.newExamForm.title,
            description: this.newExamForm.description || null,
            duration_minutes: this.newExamForm.duration_minutes,
            is_published: false,
          },
        })
      );
      this.resetNewExamForm();
    }
  }

  resetNewExamForm(): void {
    this.newExamForm = {
      title: '',
      description: '',
      duration_minutes: 60,
    };
    this.showNewExamForm = false;
  }

  toggleNewExamForm(): void {
    this.showNewExamForm = !this.showNewExamForm;
  }

  cancelNewExam(): void {
    this.resetNewExamForm();
  }
}
