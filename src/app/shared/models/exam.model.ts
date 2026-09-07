export interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  is_published: boolean;
  created_at: string;
}
