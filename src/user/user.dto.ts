export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface UserDetails {
  id: string;
  email: string;
  name?: string;
  roles: Role[];
}

export type UserSortOption = 'EMAIL_ASC' | 'NAME_ASC' | 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC';
