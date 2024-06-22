import { User } from '../user/user.dto';

export interface QuizCompletion {
  completedAt: Date;
  completedBy: User[];
  score: number;
}

export type QuizType = 'BRAINWAVES' | 'SHARK';

export interface Quiz {
  id: string;
  type: QuizType;
  date: Date;
  uploadedAt: Date;
  uploadedBy: User;
  myCompletions: QuizCompletion[];
}

export type QuizImageType = 'QUESTION' | 'ANSWER' | 'QUESTION_AND_ANSWER';

export interface QuizImage {
  imageLink: string;
  state: 'PENDING_UPLOAD' | 'READY';
  type: QuizImageType;
}

export interface QuizDetails {
  id: string;
  type: QuizType;
  date: Date;
  images: QuizImage[];
  uploadedAt: Date;
  uploadedBy: User;
  completions: QuizCompletion[];
}

export interface QuizFilters {
  excludeCompletedBy?: string[];
  excludeIllegible?: 'ME' | 'ANYONE';
}

export interface CreateQuizResult {
  quiz: Quiz;
  uploadLinks: {
    fileName: string;
    link: string;
  }[];
}
