export type QuizType = "SHARK" | "BRAINWAVES";
export type QuizState = "PENDING_UPLOAD" | "READY";

export interface Quiz {
  id: string;
  type: QuizType;
  state: QuizState;
  date: Date;
  imageLink?: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface User {
  email: string;
}
