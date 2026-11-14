export interface Candidate {
  id: string;
  exam_id: string;
  name: string;
  username: string;
  has_attempted: boolean;
}

/**
 * Creating a candidate or resetting a passcode sends the plain passcode once;
 * the database hashes it immediately and never returns it.
 */
export interface NewCandidate extends Omit<Candidate, 'id'> {
  passcode: string;
}
