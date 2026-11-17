// Shared types for Exam Coach (the /exam practice demo), used by the page and /api/exam.

export interface ExamEvidence {
  sourceTitle: string;
  /** The passage the quote was found in, so the learner can read it in context. */
  passage: string;
  /** [start, end) of the verified quote inside `passage`. */
  highlight: [number, number];
}

export interface ExamQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  answerIndex: number;
  /** Why the correct answer is correct. */
  explanation: string;
  /** One line per option on why it is wrong; the entry for the correct option is unused. */
  whyWrong: string[];
  evidence: ExamEvidence;
}

export interface ExamSet {
  title: string;
  questions: ExamQuestion[];
  /** How many generated questions were checked, and how many were dropped because their quote was not in the source. */
  checked: number;
  dropped: number;
  provider: "claude" | "groq" | "sample";
}

export interface ExamRequest {
  title: string;
  content: string;
  count: number;
  /** Topics to focus on, e.g. the learner's weak topics from the last round. */
  focus?: string[];
  /** Questions the learner has already seen, so a new round does not repeat them. */
  avoid?: string[];
}
