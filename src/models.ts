export type QuizType = "SHARK" | "BRAINWAVES";
export type QuizState = "PENDING_UPLOAD" | "READY";

export interface Quiz {
  type: QuizType;
  state: QuizState;
  date: Date;
  imageLink?: string;
}