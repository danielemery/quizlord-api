export type QuizType = "SHARK" | "BRAINWAVES";
export type QuizState = "PENDING_UPLOAD" | "READY";

export interface Quiz {
  id: string;
  type: QuizType;
  state: QuizState;
  date: Date;
  imageLink?: string;
}
