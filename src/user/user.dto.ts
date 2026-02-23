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

export interface PendingUser {
  id: string;
  email: string;
  name?: string;
}

export interface RejectedUser {
  id: string;
  email: string;
  name?: string;
  rejectedAt: Date;
  rejectedByUser: User;
}

export interface ApproveUserResult {
  success: boolean;
}

export interface RejectUserResult {
  success: boolean;
}
