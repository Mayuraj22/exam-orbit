export interface Result {
  id: string;
  candidate_id: string;
  exam_id: string;
  answers: Record<string, string>;
  score: number | null;
  submitted_at: string;
  graded_answers: Record<string, boolean> | null;
  is_fully_graded: boolean;
}
