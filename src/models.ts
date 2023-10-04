import { QuizImageState, QuizImageType, QuizType, Role } from '@prisma/client';

export interface QuizCompletion {
  completedAt: Date;
  completedBy: User[];
  score: number;
}

export interface Quiz {
  id: string;
  type: QuizType;
  date: Date;
  uploadedAt: Date;
  uploadedBy: User;
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
  uploadedBy: User;
  completions: QuizCompletion[];
}

export interface QuizFilters {
  excludeCompletedBy?: string[];
}

export interface User {
  email: string;
  name?: string;
}

export interface UserDetails {
  id: string;
  email: string;
  name?: string;
  roles: Role[];
}

export interface CreateQuizResult {
  quiz: Quiz;
  uploadLinks: {
    fileName: string;
    link: string;
  }[];
}
