import { User as UserPersistence } from '@prisma/client';
import { User } from '../models';
import { persistence } from '../persistence/persistence';
import { base64Decode, base64Encode, PagedResult } from './helpers';

function userPersistenceToUser(user: UserPersistence): User {
  return {
    email: user.email,
  };
}

export async function users(
  _: unknown,
  { first = 100, after }: { first: number; after?: string },
): Promise<PagedResult<User>> {
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
