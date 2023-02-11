import { Role } from '@prisma/client';

import { QuizlordContext } from '..';

export function base64Encode(source: string) {
  return Buffer.from(source).toString('base64');
}

export function base64Decode(source: string) {
  return Buffer.from(source, 'base64').toString('ascii');
}

export interface PagedResult<T> {
  edges: {
    cursor: string;
    node: T;
  }[];
  pageInfo: {
    hasNextPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export function requireUserRole(context: QuizlordContext, role: Role) {
  if (!context.roles.includes(role)) {
    throw new Error('You are not authorised to perform this action');
  }
}
