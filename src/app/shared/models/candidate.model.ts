/** An exam a candidate may take. */
export interface ExamAssignment {
  exam_id: string;
  /** Submitted (reset by "Reset attempt" to allow a retake). */
  has_attempted: boolean;
  assigned_at: string;
}

/** A person who can sign in and take the exams assigned to them. */
export interface Candidate {
  id: string;
  name: string;
  username: string;
  email: string | null;
  assignments: ExamAssignment[];
}

/**
 * Creating a candidate or resetting a passcode sends the plain passcode once;
 * the database hashes it immediately and never returns it.
 */
export interface NewCandidate {
  name: string;
  username: string;
  email: string | null;
  passcode: string;
}

export const assignmentFor = (c: Candidate, examId: string): ExamAssignment | undefined =>
  c.assignments.find((a) => a.exam_id === examId);
