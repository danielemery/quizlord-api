import { QuizImageState, QuizImageType, QuizType, Role } from '@prisma/client';

export interface QuizCompletion {
  completedAt: Date;
  completedBy: string[];
  score: number;
}

export interface Quiz {
  id: string;
  type: QuizType;
  date: Date;
  uploadedAt: Date;
  uploadedBy: string;
  myCompletions: QuizCompletion[];
}

export interface QuizImage {
  imageLink: string;
  state: QuizImageState;
  type: QuizImageType;
}

export interface QuizDetails {
  id: string;
  type: QuizType;
  date: Date;
  images: QuizImage[];
  uploadedAt: Date;
  uploadedBy: string;
  completions: QuizCompletion[];
}

export interface User {
  email: string;
}

export interface UserDetails {
  email: string;
  roles: Role[];
}

export interface CreateQuizResult {
  quiz: Quiz;
  uploadLinks: {
    fileName: string;
    link: string;
  }[];
}
