import { Component, inject, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { AdminExamsActions } from '../../store/exams.actions';
import {
  selectQuestions,
  selectQuestionsLoading,
  selectQuestionsError,
} from '../../store/exams.selectors';
import { QuestionType, Question } from '../../../../shared/models/question.model';

@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './question-form.component.html',
  styleUrls: ['./question-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionFormComponent implements OnInit {
  @Input() examId!: string;

  private store = inject(Store);
  private fb = inject(FormBuilder);

  questions$ = this.store.select(selectQuestions);
  filteredQuestions$ = this.questions$.pipe(
    map((questions: Question[]) => questions.filter((q: Question) => q.exam_id === this.examId).sort((a: Question, b: Question) => a.order_index - b.order_index))
  );
  loading$ = this.store.select(selectQuestionsLoading);
  error$ = this.store.select(selectQuestionsError);

  questionForm: FormGroup;
  questionType: QuestionType = 'mcq';

  constructor() {
    this.questionForm = this.fb.group({
      question_text: ['', Validators.required],
      correct_answer: ['', Validators.required],
      options: this.fb.array([this.createOption(), this.createOption()]),
    });
  }

  ngOnInit(): void {
    this.store.dispatch(AdminExamsActions.loadQuestions({ examId: this.examId }));
  }

  get options(): FormArray {
    return this.questionForm.get('options') as FormArray;
  }

  createOption(): FormGroup {
    return this.fb.group({
      text: ['', Validators.required],
      isCorrect: [false],
    });
  }

  addOption(): void {
    this.options.push(this.createOption());
  }

  removeOption(index: number): void {
    if (this.options.length > 2) {
      this.options.removeAt(index);
    }
  }

  setQuestionType(type: QuestionType): void {
    this.questionType = type;
    if (type === 'input') {
      this.questionForm.get('options')?.clearValidators();
      this.questionForm.get('options')?.setValue(null);
    } else {
      this.questionForm.setControl('options', this.fb.array([this.createOption(), this.createOption()]));
    }
  }

  submitQuestion(): void {
    if (this.questionForm.invalid) {
      return;
    }

    const formValue = this.questionForm.value;

    this.filteredQuestions$.pipe(take(1)).subscribe((qs) => {
      const currentOrderIndex = qs.length;

      let options = null;
      if (this.questionType === 'mcq') {
        options = formValue.options.map((opt: any) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: opt.text,
        }));
      }

      this.store.dispatch(
        AdminExamsActions.createQuestion({
          question: {
            exam_id: this.examId,
            question_text: formValue.question_text,
            question_type: this.questionType,
            options,
            correct_answer: formValue.correct_answer,
            order_index: currentOrderIndex,
          },
        })
      );

      this.resetForm();
    });
  }

  deleteQuestion(questionId: string): void {
    if (confirm('Are you sure you want to delete this question?')) {
      this.store.dispatch(AdminExamsActions.deleteQuestion({ id: questionId }));
    }
  }

  resetForm(): void {
    this.questionForm.reset();
    this.questionType = 'mcq';
    this.questionForm.setControl('options', this.fb.array([this.createOption(), this.createOption()]));
  }
}
