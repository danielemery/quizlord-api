import { User as UserPersistence } from '@prisma/client';
import { QuizlordContext } from '..';
import { User, UserDetails } from '../models';
import { persistence } from '../persistence/persistence';
import { base64Decode, base64Encode, PagedResult, requireUserRole } from './helpers';

function userPersistenceToUser(user: UserPersistence): User {
  return {
    email: user.email,
    name: user.name ?? undefined,
  };
}

export async function users(
  _: unknown,
  { first = 100, after }: { first: number; after?: string },
  context: QuizlordContext,
): Promise<PagedResult<User>> {
  requireUserRole(context, 'USER');
  const afterId = after ? base64Decode(after) : undefined;
  const { data, hasMoreRows } = await persistence.getUsersWithRole({
    role: 'USER',
    afterId,
    limit: first,
  });
  const edges = data.map((user) => ({
    node: userPersistenceToUser(user),
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

export async function me(_: unknown, _params: Record<string, never>, context: QuizlordContext): Promise<UserDetails> {
  return {
    id: context.userId,
    email: context.email,
    name: context.userName,
    roles: context.roles,
  };
}
