import { QuizlordContext } from '..';
import { User, UserDetails, UserSortOption } from '../models';
import { base64Decode, base64Encode, PagedResult } from '../util/paging-helpers';
import { authorisationService, userService } from '../service.locator';

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
  const { data, hasMoreRows } = await userService.getUsers({
    userId: context.userId,
    afterId,
    first,
    sortedBy,
  });
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

export const userQueries = {
  users,
  me,
};
