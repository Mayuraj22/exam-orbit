export type QuestionType = 'mcq' | 'input';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: QuestionType;
  options: QuestionOption[] | null;
  correct_answer: string | null;
  order_index: number;
}
