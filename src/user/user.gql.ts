import { QuizlordContext } from '../index.js';
import { authorisationService, userService } from '../service.locator.js';
import { base64Decode, base64Encode, PagedResult } from '../util/paging-helpers.js';
import {
  ApproveUserResult,
  PendingUser,
  RejectedUser,
  RejectUserResult,
  Role,
  User,
  UserDetails,
  UserSortOption,
} from './user.dto.js';
import { GetUsersResult } from './user.service.js';

async function users(
  _: unknown,
  {
    first = 100,
    after,
    sortedBy = 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC',
  }: { first: number; after?: string; sortedBy: UserSortOption },
  context: QuizlordContext,
): Promise<PagedResult<User>> {
  authorisationService.requireUserRole(context, 'USER');
  const afterId = after ? base64Decode(after) : undefined;
  let serviceResult: GetUsersResult;
  if (sortedBy === 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC') {
    serviceResult = await userService.getUsers(first, sortedBy, context.userId, afterId);
  } else {
    serviceResult = await userService.getUsers(first, sortedBy, afterId);
  }
  const { data, hasMoreRows } = serviceResult;
  const edges = data.map((user) => ({
    node: user,
    cursor: base64Encode(user.id),
  }));
  const result = {
    edges,
    pageInfo: {
      hasNextPage: hasMoreRows,
      startCursor: edges.length > 0 ? edges[0].cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
    },
  };
  return result;
}

async function me(_: unknown, _params: Record<string, never>, context: QuizlordContext): Promise<UserDetails> {
  return {
    id: context.userId,
    email: context.email,
    name: context.userName,
    roles: context.roles,
  };
}

async function pendingUsers(
  _: unknown,
  _params: Record<string, never>,
  context: QuizlordContext,
): Promise<PendingUser[]> {
  authorisationService.requireUserRole(context, 'ADMIN');
  return userService.getPendingUsers();
}

async function rejectedUsers(
  _: unknown,
  _params: Record<string, never>,
  context: QuizlordContext,
): Promise<RejectedUser[]> {
  authorisationService.requireUserRole(context, 'ADMIN');
  return userService.getRejectedUsers();
}

async function approveUser(
  _: unknown,
  { userId, roles }: { userId: string; roles: Role[] },
  context: QuizlordContext,
): Promise<ApproveUserResult> {
  authorisationService.requireUserRole(context, 'ADMIN');
  return userService.approveUser(userId, roles);
}

async function rejectUser(
  _: unknown,
  { userId }: { userId: string },
  context: QuizlordContext,
): Promise<RejectUserResult> {
  authorisationService.requireUserRole(context, 'ADMIN');
  return userService.rejectUser(userId, context.userId);
}

export const userQueries = {
  users,
  me,
  pendingUsers,
  rejectedUsers,
};

export const userMutations = {
  approveUser,
  rejectUser,
};
