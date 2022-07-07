export type QuizType = "SHARK" | "BRAINWAVES";
export type QuizState = "PENDING_UPLOAD" | "READY";

export interface QuizCompletion {
  completedAt: Date;
  completedBy: string[];
  score: number;
}

export interface Quiz {
  id: string;
  type: QuizType;
  state: QuizState;
  date: Date;
  uploadedAt: Date;
  uploadedBy: string;
  myCompletions: QuizCompletion[];
}

export interface QuizDetails {
  id: string;
  type: QuizType;
  state: QuizState;
  date: Date;
  imageLink?: string;
  uploadedAt: Date;
  uploadedBy: string;
  completions: QuizCompletion[];
}
